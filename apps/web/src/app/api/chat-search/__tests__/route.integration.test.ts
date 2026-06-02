import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createContentClient,
  createThrowingClient,
  createToolUseClient,
  type MessagesCreateOptions,
  toAnthropicClient,
} from "@/lib/ai/__tests__/anthropic-test-helpers";
import { setAnthropicClientForTesting } from "@/lib/ai/anthropic-client";
import { UPDATE_CRITERIA_TOOL_NAME } from "@/lib/ai/tools";
import { POST } from "../route";

/**
 * `/api/chat-search` の Tool Use 対応後の振る舞いと、Issue #82（abort 伝播）
 * を網羅するインテグレーションテスト。
 *
 * - 正常系: SSE で criteria / message / results / done が順に流れる
 * - 異常系: tool_use がない / 例外
 * - Abort: 事前 abort で即 close、SDK 呼び出し中 abort で静かに終了
 */

const SESSION_ID = "11111111-2222-4333-8444-555555555555";

const readSseEvents = async (
  response: Response,
): Promise<Array<{ type: string; [key: string]: unknown }>> => {
  const reader = response.body?.getReader();
  if (!reader) return [];
  const decoder = new TextDecoder();
  let buffer = "";
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.replace(/^data: /, "");
      if (!line) continue;
      events.push(JSON.parse(line));
    }
  }
  return events;
};

const buildRequest = (body: unknown, signal?: AbortSignal): Request => {
  const init: RequestInit & { signal?: AbortSignal } = {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  };
  if (signal) init.signal = signal;
  return new Request("http://localhost/api/chat-search", init);
};

describe("POST /api/chat-search (Tool Use)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    setAnthropicClientForTesting(null);
  });

  it("tool_use の input から criteria / message / results を SSE で配信する", async () => {
    const fake = createToolUseClient(
      {
        message: "東京で絞り込みます。",
        criteria: {
          prefecture: "東京都",
          buildingTypes: [],
          conditions: [],
          businessCategoryRefs: [],
        },
      },
      UPDATE_CRITERIA_TOOL_NAME,
    );
    setAnthropicClientForTesting(toAnthropicClient(fake));

    const response = await POST(
      buildRequest({
        sessionId: SESSION_ID,
        messages: [{ role: "user", content: "東京で店舗物件を探したいです" }],
      }),
    );
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const events = await readSseEvents(response);
    const types = events.map((e) => e.type);
    expect(types).toEqual(["criteria", "message", "results", "done"]);

    const criteriaEvent = events[0] as { type: "criteria"; criteria: { prefecture?: string } };
    expect(criteriaEvent.criteria.prefecture).toBe("東京都");

    const messageEvent = events[1] as { type: "message"; content: string };
    expect(messageEvent.content).toBe("東京で絞り込みます。");

    const resultsEvent = events[2] as { type: "results"; properties: ReadonlyArray<unknown> };
    expect(Array.isArray(resultsEvent.properties)).toBe(true);
  });

  it("tools と tool_choice が SDK 呼び出しに渡されている", async () => {
    const fake = createToolUseClient({ message: "OK" }, UPDATE_CRITERIA_TOOL_NAME);
    setAnthropicClientForTesting(toAnthropicClient(fake));

    await readSseEvents(
      await POST(
        buildRequest({
          sessionId: SESSION_ID,
          messages: [{ role: "user", content: "教えて" }],
        }),
      ),
    );

    const [first] = fake.capturedArgs;
    expect(first).toBeDefined();
    expect(first?.args.tools).toBeDefined();
    expect(first?.args.tool_choice).toEqual({
      type: "tool",
      name: UPDATE_CRITERIA_TOOL_NAME,
    });
    // SDK の signal が指定されていること（Issue #82）
    expect((first?.options as MessagesCreateOptions | undefined)?.signal).toBeInstanceOf(
      AbortSignal,
    );
  });

  it("不正な criteria input は fallback の EMPTY_SEARCH_CRITERIA を維持する", async () => {
    const fake = createToolUseClient(
      {
        message: "更新できません",
        criteria: { prefecture: "江戸府" },
      },
      UPDATE_CRITERIA_TOOL_NAME,
    );
    setAnthropicClientForTesting(toAnthropicClient(fake));

    const events = await readSseEvents(
      await POST(
        buildRequest({
          sessionId: SESSION_ID,
          messages: [{ role: "user", content: "江戸府で探して" }],
        }),
      ),
    );
    const criteriaEvent = events.find((e) => e.type === "criteria") as
      | { criteria: { prefecture?: string } }
      | undefined;
    expect(criteriaEvent?.criteria.prefecture).toBeUndefined();
  });

  it("tool_use ブロックが含まれない応答は SSE error を返す", async () => {
    const fake = createContentClient([{ type: "text", text: "自由テキストです" }]);
    setAnthropicClientForTesting(toAnthropicClient(fake));

    const events = await readSseEvents(
      await POST(
        buildRequest({
          sessionId: SESSION_ID,
          messages: [{ role: "user", content: "x" }],
        }),
      ),
    );
    const err = events.find((e) => e.type === "error") as { error: string } | undefined;
    expect(err?.error).toContain("構造化結果");
  });

  it("SDK 例外はサニタイズされた SSE error として返る", async () => {
    setAnthropicClientForTesting(
      toAnthropicClient(createThrowingClient(new Error("内部 SDK 失敗"))),
    );
    const events = await readSseEvents(
      await POST(
        buildRequest({
          sessionId: SESSION_ID,
          messages: [{ role: "user", content: "x" }],
        }),
      ),
    );
    const err = events.find((e) => e.type === "error") as { error: string } | undefined;
    expect(err?.error).toBe("処理中にエラーが発生しました。時間をおいて再度お試しください。");
  });

  it("リクエスト形式不正は 400", async () => {
    const response = await POST(
      buildRequest({
        sessionId: "not-a-uuid",
        messages: [],
      }),
    );
    expect(response.status).toBe(400);
  });

  // Issue #82: abort 伝播
  it("受け取り前にすでに abort 済みの request は SSE を即終了する", async () => {
    // SDK は触られても OK だが、こちらは触れていないことを期待する。
    const fake = createToolUseClient({ message: "OK" }, UPDATE_CRITERIA_TOOL_NAME);
    setAnthropicClientForTesting(toAnthropicClient(fake));

    const controller = new AbortController();
    controller.abort();
    const response = await POST(
      buildRequest(
        {
          sessionId: SESSION_ID,
          messages: [{ role: "user", content: "x" }],
        },
        controller.signal,
      ),
    );
    const events = await readSseEvents(response);
    expect(events).toEqual([]);
    // SDK は呼ばれていない
    expect(fake.capturedArgs).toHaveLength(0);
  });

  it("SDK 呼び出し中に abort されたらストリームは静かに閉じる（error イベントを出さない）", async () => {
    const ac = new AbortController();
    // SDK の create が abort を尊重して投げる形を模す
    const create = (
      _args: unknown,
      options?: { signal?: AbortSignal | null },
    ): Promise<{ content: ReadonlyArray<unknown> }> => {
      return new Promise((_resolve, reject) => {
        const onAbort = (): void => {
          const err = new Error("Request was aborted.");
          err.name = "APIUserAbortError";
          reject(err);
        };
        if (options?.signal?.aborted) {
          onAbort();
          return;
        }
        options?.signal?.addEventListener("abort", onAbort, { once: true });
      });
    };
    const fakeClient = { messages: { create } } as unknown as Parameters<
      typeof setAnthropicClientForTesting
    >[0];
    setAnthropicClientForTesting(fakeClient);

    const response = await POST(
      buildRequest(
        {
          sessionId: SESSION_ID,
          messages: [{ role: "user", content: "x" }],
        },
        ac.signal,
      ),
    );
    // 直後に abort
    setTimeout(() => ac.abort(), 0);
    const events = await readSseEvents(response);
    // abort 由来は error を流さない
    expect(events.find((e) => e.type === "error")).toBeUndefined();
  });
});
