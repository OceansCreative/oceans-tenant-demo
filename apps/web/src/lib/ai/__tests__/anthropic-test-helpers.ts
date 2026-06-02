import type { AnthropicClient } from "@/lib/ai/anthropic-client";

/**
 * テスト用 Anthropic クライアントのモック生成ヘルパー。
 *
 * Tool Use 化に伴い、`messages.create` のレスポンスは `tool_use` ブロックを
 * 含む形に変わった。Vitest のテストでは本番 SDK を叩かず、ここで生成した
 * フェイクを `setAnthropicClientForTesting` で差し込む。
 */

export type ToolUseBlockFixture = {
  readonly type: "tool_use";
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
};

export type TextBlockFixture = {
  readonly type: "text";
  readonly text: string;
};

export type ContentBlockFixture = ToolUseBlockFixture | TextBlockFixture;

export type MessagesCreateOptions = {
  readonly signal?: AbortSignal | null;
};

export type MessagesCreateArgs = {
  readonly model: string;
  readonly tools?: ReadonlyArray<unknown>;
  readonly tool_choice?: unknown;
  readonly messages: ReadonlyArray<unknown>;
  readonly system?: string;
  readonly max_tokens: number;
};

export type FakeMessagesCreate = (
  args: MessagesCreateArgs,
  options?: MessagesCreateOptions,
) => Promise<{ content: ReadonlyArray<ContentBlockFixture> }>;

export type FakeAnthropicClient = {
  readonly messages: {
    readonly create: FakeMessagesCreate;
  };
  readonly capturedArgs: ReadonlyArray<{
    args: MessagesCreateArgs;
    options: MessagesCreateOptions | undefined;
  }>;
};

/**
 * 固定の tool_use ブロックを返す Anthropic クライアントモックを作る。
 *
 * @param toolUseInput Claude が返す `input`（ツールに渡されるオブジェクト）
 * @param toolName 既定は extract_property / 第 3 引数で上書き可能
 */
export const createToolUseClient = (
  toolUseInput: unknown,
  toolName = "extract_property",
): FakeAnthropicClient => {
  const captured: Array<{
    args: MessagesCreateArgs;
    options: MessagesCreateOptions | undefined;
  }> = [];
  const create: FakeMessagesCreate = async (args, options) => {
    captured.push({ args, options });
    return {
      content: [
        {
          type: "tool_use",
          id: "toolu_test_001",
          name: toolName,
          input: toolUseInput,
        },
      ],
    };
  };
  const client = {
    messages: { create },
    get capturedArgs() {
      return captured;
    },
  };
  return client as unknown as FakeAnthropicClient;
};

/**
 * `messages.create` が指定の例外を投げるモック。
 */
export const createThrowingClient = (error: unknown): FakeAnthropicClient => {
  const captured: Array<{
    args: MessagesCreateArgs;
    options: MessagesCreateOptions | undefined;
  }> = [];
  const create: FakeMessagesCreate = async (args, options) => {
    captured.push({ args, options });
    throw error;
  };
  const client = {
    messages: { create },
    get capturedArgs() {
      return captured;
    },
  };
  return client as unknown as FakeAnthropicClient;
};

/**
 * 自由なコンテンツブロックを返すモック。
 */
export const createContentClient = (
  content: ReadonlyArray<ContentBlockFixture>,
): FakeAnthropicClient => {
  const captured: Array<{
    args: MessagesCreateArgs;
    options: MessagesCreateOptions | undefined;
  }> = [];
  const create: FakeMessagesCreate = async (args, options) => {
    captured.push({ args, options });
    return { content };
  };
  const client = {
    messages: { create },
    get capturedArgs() {
      return captured;
    },
  };
  return client as unknown as FakeAnthropicClient;
};

/**
 * `AnthropicClient` 型に揃えるためのキャスト。route 側は `Pick<Anthropic, "messages">`
 * しか使わないので、フェイクで十分。
 */
export const toAnthropicClient = (fake: FakeAnthropicClient): AnthropicClient =>
  fake as unknown as AnthropicClient;
