import { derivePropertyTsubo, type Property, propertySchema } from "@oceans-tenant/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic-client";
import { extractReadableContent, isValidIngestUrl } from "@/lib/ai/html-extraction";
import {
  buildExtractPropertyUserPrompt,
  PROPERTY_EXTRACT_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/extract-property";

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
  readonly details?: unknown;
};

const parseClaudeJson = (text: string): unknown => {
  // Claude が ```json ... ``` で囲んだ場合の救済
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\n([\s\S]*?)\n```/);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
};

const fetchHtml = async (url: string, signal: AbortSignal): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "OceansTenantBot/0.1 (+https://github.com/OceansCreative/oceans-tenant-demo)",
      Accept: "text/html",
    },
    signal,
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`URL の取得に失敗しました: HTTP ${response.status}`);
  }
  return await response.text();
};

export const POST = async (
  request: Request,
): Promise<NextResponse<IngestSuccessResponse | IngestErrorResponse>> => {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body = (await request.json()) as unknown;
    parsed = RequestSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "リクエスト形式が不正です",
        details: error instanceof Error ? error.message : error,
      },
      { status: 400 },
    );
  }

  if (!isValidIngestUrl(parsed.url)) {
    return NextResponse.json(
      { status: "error", error: "url は http(s) スキームの URL である必要があります" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);

  try {
    const html = await fetchHtml(parsed.url, controller.signal);
    const extracted = extractReadableContent(html, parsed.url);
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
            sourceUrl: parsed.url,
            extractedHtmlText: extracted.textContent,
          }),
        },
      ],
    });

    const textBlock = completion.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
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
        sourceUrl: parsed.url,
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
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("aborted")) {
      return NextResponse.json(
        { status: "error", error: "URL の取得がタイムアウトしました" },
        { status: 504 },
      );
    }
    if (message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json({ status: "error", error: message }, { status: 503 });
    }
    return NextResponse.json(
      { status: "error", error: "抽出に失敗しました", details: message },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
};
