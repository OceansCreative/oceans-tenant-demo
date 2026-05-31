import { derivePropertyTsubo, type Property, propertySchema } from "@oceans-tenant/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic-client";
import { extractReadableContent, isValidIngestUrl } from "@/lib/ai/html-extraction";
import {
  buildExtractPropertyUserPrompt,
  PROPERTY_EXTRACT_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/extract-property";
import { FetchSafetyError, fetchHtmlSafe, SsrfDeniedError } from "@/lib/ai/url-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  url: z.string().min(1, "url は必須です"),
});

type IngestSuccessResponse = {
  readonly status: "ok";
  readonly draft: Property & { readonly tsubo: number };
  readonly confidence: number;
};

type IngestErrorResponse = {
  readonly status: "error";
  readonly error: string;
};

const parseClaudeJson = (text: string): unknown => {
  // Claude が ```json ... ``` で囲んだ場合の救済
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\n([\s\S]*?)\n```/);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
};

export const POST = async (
  request: Request,
): Promise<NextResponse<IngestSuccessResponse | IngestErrorResponse>> => {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body = (await request.json()) as unknown;
    parsed = RequestSchema.parse(body);
  } catch (error) {
    console.error("[ingest-url] リクエスト形式不正", error);
    return NextResponse.json(
      { status: "error", error: "リクエスト形式が不正です" },
      { status: 400 },
    );
  }

  if (!isValidIngestUrl(parsed.url)) {
    return NextResponse.json(
      { status: "error", error: "url は http(s) スキームの URL である必要があります" },
      { status: 400 },
    );
  }

  try {
    // SSRF 防御込みの安全 fetch（DNS → IP 検証、per-hop redirect、サイズ上限、タイムアウト）
    const fetched = await fetchHtmlSafe(parsed.url);
    if (fetched.status >= 400) {
      return NextResponse.json(
        { status: "error", error: `URL の取得に失敗しました: HTTP ${fetched.status}` },
        { status: 422 },
      );
    }

    const extracted = extractReadableContent(fetched.body, fetched.url);
    if (extracted.textContent.length < 50) {
      return NextResponse.json(
        { status: "error", error: "本文を抽出できませんでした" },
        { status: 422 },
      );
    }

    const client = getAnthropicClient();
    const completion = await client.messages.create({
      model: getAnthropicModel(),
      max_tokens: 2048,
      system: PROPERTY_EXTRACT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildExtractPropertyUserPrompt({
            sourceUrl: fetched.url,
            extractedHtmlText: extracted.textContent,
          }),
        },
      ],
    });

    const textBlock = completion.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("[ingest-url] AI 応答にテキストブロックが含まれていません");
      return NextResponse.json(
        { status: "error", error: "AI 応答にテキストが含まれていません" },
        { status: 502 },
      );
    }

    const json = parseClaudeJson(textBlock.text);
    // listedByRef は AI には不明なので、デモ用の既定値で埋める
    const draftWithDefaults = {
      ...(typeof json === "object" && json !== null ? json : {}),
      listedByRef: (json as { listedByRef?: string }).listedByRef ?? "company-001",
      aiMeta: {
        aiExtracted: true,
        aiConfidence: (json as { aiConfidence?: number }).aiConfidence ?? 0.7,
        sourceUrl: fetched.url,
      },
    };
    const property = propertySchema.parse(draftWithDefaults);
    const draft = derivePropertyTsubo(property);

    return NextResponse.json(
      {
        status: "ok",
        draft,
        confidence: property.aiMeta.aiConfidence ?? 0.7,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleIngestError(error);
  }
};

/**
 * クライアントには定型文のみ、詳細はサーバーログのみに残す。
 * SSRF / サイズ超過 / タイムアウト / API キー欠落 はそれぞれ専用のステータスコードで返す。
 */
const handleIngestError = (error: unknown): NextResponse<IngestErrorResponse> => {
  if (error instanceof SsrfDeniedError) {
    console.error("[ingest-url] SSRF denied", error.message);
    return NextResponse.json(
      { status: "error", error: "指定された URL は内部レンジを指しているため拒否しました" },
      { status: 400 },
    );
  }
  if (error instanceof FetchSafetyError) {
    console.error("[ingest-url] fetch safety", error.code, error.message);
    const map: Record<FetchSafetyError["code"], { status: number; message: string }> = {
      size_exceeded: { status: 413, message: "応答サイズが上限を超えました" },
      too_many_redirects: { status: 421, message: "リダイレクト回数が多すぎます" },
      invalid_scheme: { status: 400, message: "不正な URL スキームです" },
      invalid_redirect: { status: 502, message: "リダイレクト先が不正です" },
      fetch_failed: { status: 502, message: "URL の取得に失敗しました" },
    };
    const { status, message } = map[error.code];
    return NextResponse.json({ status: "error", error: message }, { status });
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("aborted") || error instanceof DOMException) {
    console.error("[ingest-url] timeout", message);
    return NextResponse.json(
      { status: "error", error: "URL の取得がタイムアウトしました" },
      { status: 504 },
    );
  }
  if (message.includes("ANTHROPIC_API_KEY")) {
    // 環境変数欠落はユーザーに伝える価値がある（運用者向け）
    return NextResponse.json({ status: "error", error: message }, { status: 503 });
  }
  console.error("[ingest-url] unexpected", error);
  return NextResponse.json({ status: "error", error: "抽出に失敗しました" }, { status: 500 });
};
