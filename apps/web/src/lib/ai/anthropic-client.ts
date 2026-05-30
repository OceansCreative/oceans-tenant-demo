import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic Claude SDK の薄いラッパー。
 *
 * - API キーは process.env.ANTHROPIC_API_KEY から読み込む
 * - モデルは ANTHROPIC_MODEL 環境変数で上書き可能（既定 claude-sonnet-4-5）
 * - テストで `client` を差し替えやすいよう依存性注入を許す
 */

export type AnthropicClient = Pick<Anthropic, "messages">;

let cachedClient: AnthropicClient | null = null;

export const getAnthropicClient = (): AnthropicClient => {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY が未設定です。.env.local もしくは Vercel の環境変数に設定してください。",
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
};

export const setAnthropicClientForTesting = (client: AnthropicClient | null): void => {
  cachedClient = client;
};

export const getAnthropicModel = (): string => process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
