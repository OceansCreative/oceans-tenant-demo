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
import { UPDATE_CRITERIA_TOOL_NAME, updateCriteriaTool } from "@/lib/ai/tools";
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
  | { type: "results"; properties: ReturnType<typeof filterProperties>["items"] }
  | { type: "done" }
  | { type: "error"; error: string };

const encoder = new TextEncoder();

const writeEvent = (event: SseEvent): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/**
 * Claude の `tool_use` ブロック（`update_criteria`）の input を取り出して
 * `searchCriteriaSchema` で再バリデーションする。
 *
 * Tool Use を使うことで、Claude が必ず構造化フォーマットで応答することを
 * Anthropic 側でも保証できる（自由テキストでの誤出力を抑制）。
 * ただし `tool_choice` で強制しても列挙値違反等は起こり得るため、
 * サーバー側でも `safeParse` を必ず通す。
 *
 * Issue #57 の要求を満たす実装（Tool Use 化後）。
 */
export const parseClaudeCriteriaToolInput = (
  rawInput: unknown,
  fallback: SearchCriteria,
): { message: string; criteria: SearchCriteria } => {
  if (typeof rawInput !== "object" || rawInput === null) {
    console.error("[chat-search] tool_use input が object ではない", rawInput);
    return {
      message: "応答を解析できませんでした。",
      criteria: fallback,
    };
  }
  const obj = rawInput as { message?: unknown; criteria?: unknown };
  const message = typeof obj.message === "string" && obj.message.length > 0 ? obj.message : null;
  // criteria 未指定 / null は「条件は変えない」を意味する
  if (obj.criteria === undefined || obj.criteria === null) {
    return {
      message: message ?? "条件を更新しました。",
      criteria: fallback,
    };
  }
  const validated = searchCriteriaSchema.safeParse(obj.criteria);
  if (!validated.success) {
    console.error("[chat-search] Claude 出力の criteria 検証失敗", validated.error.flatten());
    return {
      message: message ?? "条件の更新ができませんでした。別の言い回しで試してみてください。",
      criteria: fallback,
    };
  }
  return {
    message: message ?? "条件を更新しました。",
    criteria: validated.data,
  };
};

/**
 * Anthropic の `content` 配列から `update_criteria` ツール呼び出しを探す。
 */
const findUpdateCriteriaToolUse = (
  blocks: ReadonlyArray<{ type: string }>,
): { input: unknown } | null => {
  for (const block of blocks) {
    if (block.type === "tool_use") {
      const tu = block as { type: "tool_use"; name: string; input: unknown };
      if (tu.name === UPDATE_CRITERIA_TOOL_NAME) {
        return { input: tu.input };
      }
    }
  }
  return null;
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

/**
 * `AbortSignal` 由来の中断を示す例外。
 *
 * Anthropic SDK は AbortSignal の発火に対し `APIUserAbortError` や
 * 標準 `AbortError` を投げる実装になっており、ライブラリ間で名前が揺れる。
 * メッセージ / `.name` に "abort" を含むかを単一の判定軸にする。
 */
export const isAbortError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { name?: unknown; message?: unknown };
  const name = typeof e.name === "string" ? e.name.toLowerCase() : "";
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return name.includes("abort") || msg.includes("abort");
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
  // クライアント切断時に Anthropic 呼び出しを中断するための signal（Issue #82）。
  // POST ハンドラの request.signal をそのまま SDK に伝搬する。
  const requestSignal: AbortSignal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeClose = (): void => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // 既に close 済みの場合は無視
        }
      };
      const safeEnqueue = (chunk: Uint8Array): void => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          // ストリームがクライアント側で閉じられた直後の enqueue は握りつぶす
        }
      };

      // クライアント切断時はストリームを閉じる（Anthropic への abort 伝搬は
      // SDK 側に signal を渡すことで行う）。
      const onAbort = (): void => {
        // クライアントは既に切断しているため enqueue は意味がないが、
        // controller.close() を呼んでサーバー側リソース（バックエンド読み出し）を
        // 解放する。
        safeClose();
      };
      if (requestSignal.aborted) {
        safeClose();
        return;
      }
      requestSignal.addEventListener("abort", onAbort, { once: true });

      try {
        const client = getAnthropicClient();
        const completion = await client.messages.create(
          {
            model: getAnthropicModel(),
            max_tokens: 1024,
            system: CHAT_SEARCH_SYSTEM_PROMPT,
            tools: [updateCriteriaTool],
            tool_choice: { type: "tool", name: UPDATE_CRITERIA_TOOL_NAME },
            messages: [
              ...toAnthropicMessages(parsed.messages),
              {
                role: "user",
                content: buildChatSearchUserContext({ currentCriteria }),
              },
            ],
          },
          // Anthropic SDK は第 2 引数で AbortSignal を受け付ける（Issue #82）。
          { signal: requestSignal },
        );

        // クライアントが SDK 完了後に切断した場合は以降の enqueue を抑止する。
        if (requestSignal.aborted) {
          safeClose();
          return;
        }

        const toolUse = findUpdateCriteriaToolUse(completion.content);
        if (!toolUse) {
          console.error("[chat-search] AI 応答に update_criteria ツール呼び出しが含まれていません");
          safeEnqueue(
            writeEvent({ type: "error", error: "AI 応答に構造化結果が含まれていません" }),
          );
          safeClose();
          return;
        }

        const { message, criteria } = parseClaudeCriteriaToolInput(toolUse.input, currentCriteria);

        safeEnqueue(writeEvent({ type: "criteria", criteria }));
        safeEnqueue(writeEvent({ type: "message", content: message }));

        const results = filterProperties(MOCK_PROPERTIES, criteria);
        safeEnqueue(writeEvent({ type: "results", properties: results.items }));
        safeEnqueue(writeEvent({ type: "done" }));
        safeClose();
      } catch (error) {
        // abort 由来の例外は SSE error として返さず静かに閉じる。
        if (isAbortError(error) || requestSignal.aborted) {
          safeClose();
          return;
        }
        safeEnqueue(writeEvent({ type: "error", error: sanitizeErrorForClient(error) }));
        safeClose();
      } finally {
        requestSignal.removeEventListener("abort", onAbort);
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
