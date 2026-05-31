import {
  EMPTY_SEARCH_CRITERIA,
  type SearchCriteria,
  searchCriteriaSchema,
} from "@oceans-tenant/shared";
import { z } from "zod";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic-client";
import {
  buildChatSearchUserContext,
  CHAT_SEARCH_SYSTEM_PROMPT,
  toAnthropicMessages,
} from "@/lib/ai/prompts/chat-search";
import { filterProperties } from "@/lib/filter-properties";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const RequestSchema = z.object({
  sessionId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      "sessionId は UUID v4 形式",
    ),
  messages: z.array(ChatMessageSchema).min(1).max(50),
  // currentCriteria は shared の searchCriteriaSchema を再利用し、
  // クライアント由来の値も Claude 出力と同じ検証を通す。
  currentCriteria: searchCriteriaSchema.optional(),
});

type SseEvent =
  | { type: "criteria"; criteria: SearchCriteria }
  | { type: "message"; content: string }
  | { type: "results"; properties: ReturnType<typeof filterProperties> }
  | { type: "done" }
  | { type: "error"; error: string };

const encoder = new TextEncoder();

const writeEvent = (event: SseEvent): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/**
 * Claude が返した JSON を `searchCriteriaSchema` で必ず再バリデーションする。
 *
 * 不正な値（未知の都道府県・列挙値違反・型ズレ等）が GROQ レイヤに到達しない
 * よう、`safeParse` で防ぐ。失敗時は現状の criteria を維持し、ユーザーには
 * 「条件の更新ができませんでした」と伝える。
 *
 * Issue #57 の要求を満たす実装。
 */
export const parseClaudeCriteriaResponse = (
  text: string,
  fallback: SearchCriteria,
): { message: string; criteria: SearchCriteria } => {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\n([\s\S]*?)\n```/);
  try {
    const parsed = JSON.parse(fence?.[1] ?? trimmed) as {
      message?: string;
      extractedCriteria?: unknown;
    };
    if (parsed.extractedCriteria === undefined || parsed.extractedCriteria === null) {
      return {
        message: parsed.message ?? "条件を更新しました。",
        criteria: fallback,
      };
    }
    const validated = searchCriteriaSchema.safeParse(parsed.extractedCriteria);
    if (!validated.success) {
      console.error("[chat-search] Claude 出力の criteria 検証失敗", validated.error.flatten());
      return {
        message:
          parsed.message ?? "条件の更新ができませんでした。別の言い回しで試してみてください。",
        criteria: fallback,
      };
    }
    return {
      message: parsed.message ?? "条件を更新しました。",
      criteria: validated.data,
    };
  } catch (error) {
    console.error("[chat-search] Claude 応答 JSON パース失敗", error);
    return {
      // パース失敗時は応答テキストの先頭 400 字を案内文として返す
      message: trimmed.slice(0, 400) || "応答を解析できませんでした。",
      criteria: fallback,
    };
  }
};

/**
 * SSE エラーメッセージのサニタイズ（Issue #55）。
 *
 * クライアントには定型文のみ、詳細は server-side `console.error` に。
 * 例外的に、ANTHROPIC_API_KEY 未設定のメッセージは運用者向けに必要な情報なので
 * ホワイトリスト的に通す。
 */
export const sanitizeErrorForClient = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ANTHROPIC_API_KEY")) {
    return message;
  }
  console.error("[chat-search] サーバー側エラー", error);
  return "処理中にエラーが発生しました。時間をおいて再度お試しください。";
};

export const POST = async (request: Request): Promise<Response> => {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body = (await request.json()) as unknown;
    parsed = RequestSchema.parse(body);
  } catch (error) {
    console.error("[chat-search] リクエスト形式不正", error);
    return new Response(JSON.stringify({ error: "リクエスト形式が不正です" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const currentCriteria: SearchCriteria = parsed.currentCriteria ?? EMPTY_SEARCH_CRITERIA;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const client = getAnthropicClient();
        const completion = await client.messages.create({
          model: getAnthropicModel(),
          max_tokens: 1024,
          system: CHAT_SEARCH_SYSTEM_PROMPT,
          messages: [
            ...toAnthropicMessages(parsed.messages),
            {
              role: "user",
              content: buildChatSearchUserContext({ currentCriteria }),
            },
          ],
        });

        const textBlock = completion.content.find((block) => block.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          console.error("[chat-search] AI 応答にテキストブロックが含まれていません");
          controller.enqueue(
            writeEvent({ type: "error", error: "AI 応答にテキストが含まれていません" }),
          );
          controller.close();
          return;
        }

        const { message, criteria } = parseClaudeCriteriaResponse(textBlock.text, currentCriteria);

        controller.enqueue(writeEvent({ type: "criteria", criteria }));
        controller.enqueue(writeEvent({ type: "message", content: message }));

        const results = filterProperties(MOCK_PROPERTIES, criteria);
        controller.enqueue(writeEvent({ type: "results", properties: results }));
        controller.enqueue(writeEvent({ type: "done" }));
        controller.close();
      } catch (error) {
        controller.enqueue(writeEvent({ type: "error", error: sanitizeErrorForClient(error) }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
