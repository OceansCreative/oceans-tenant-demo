import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/ai/anthropic-client.ts` の単体テスト。
 *
 * - 内部キャッシュ (`cachedClient`) を抱える設計なので、各テスト前後で
 *   `setAnthropicClientForTesting(null)` してリセットする。
 * - `@anthropic-ai/sdk` の `Anthropic` クラス本体は `vi.mock` で差し替え、
 *   実 API キー無しでもコンストラクタ引数とインスタンス生成の挙動を観測できる。
 * - 既存の `anthropic-test-helpers.ts` は API ルート側のフェイク用なので、
 *   ここでは独自に SDK 自体をモックする（責務が違う）。
 */

// SDK 本体をモック。`new Anthropic({ apiKey })` 呼び出しを観測できるようにする。
const anthropicConstructorSpy = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    public readonly messages: { create: ReturnType<typeof vi.fn> };
    constructor(opts: { apiKey?: string }) {
      anthropicConstructorSpy(opts);
      this.messages = { create: vi.fn() };
    }
  }
  return { default: MockAnthropic };
});

const ORIGINAL_ENV = { ...process.env };

const importModule = async () => {
  // モジュール内のキャッシュをまっさらにするため、毎テスト import.meta を resetModules で破棄。
  vi.resetModules();
  return await import("@/lib/ai/anthropic-client");
};

describe("getAnthropicClient", () => {
  beforeEach(() => {
    anthropicConstructorSpy.mockClear();
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("ANTHROPIC_API_KEY 未設定だと日本語エラーを投げる", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const mod = await importModule();
    expect(() => mod.getAnthropicClient()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("ANTHROPIC_API_KEY が undefined（delete）だと日本語エラーを投げる", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const mod = await importModule();
    expect(() => mod.getAnthropicClient()).toThrow(/\.env\.local もしくは Vercel の環境変数に設定/);
  });

  it("ANTHROPIC_API_KEY が設定されていれば Anthropic を 1 回だけ生成する", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-dummy-xxx";
    const mod = await importModule();
    const c1 = mod.getAnthropicClient();
    const c2 = mod.getAnthropicClient();
    expect(c1).toBe(c2);
    expect(anthropicConstructorSpy).toHaveBeenCalledTimes(1);
    expect(anthropicConstructorSpy).toHaveBeenCalledWith({ apiKey: "sk-test-dummy-xxx" });
  });

  it("setAnthropicClientForTesting でキャッシュを差し替えられる", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-dummy-xxx";
    const mod = await importModule();
    const fake = { messages: { create: vi.fn() } } as unknown as ReturnType<
      typeof mod.getAnthropicClient
    >;
    mod.setAnthropicClientForTesting(fake);
    expect(mod.getAnthropicClient()).toBe(fake);
    // 注入したので SDK のコンストラクタは呼ばれていない
    expect(anthropicConstructorSpy).not.toHaveBeenCalled();
  });

  it("setAnthropicClientForTesting(null) でキャッシュを破棄でき、次回は再生成", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-dummy-xxx";
    const mod = await importModule();
    const fake = { messages: { create: vi.fn() } } as unknown as ReturnType<
      typeof mod.getAnthropicClient
    >;
    mod.setAnthropicClientForTesting(fake);
    expect(mod.getAnthropicClient()).toBe(fake);
    mod.setAnthropicClientForTesting(null);
    const fresh = mod.getAnthropicClient();
    expect(fresh).not.toBe(fake);
    expect(anthropicConstructorSpy).toHaveBeenCalledTimes(1);
  });
});

describe("getAnthropicModel", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("ANTHROPIC_MODEL が未設定なら既定 claude-sonnet-4-5 を返す", async () => {
    delete process.env.ANTHROPIC_MODEL;
    const mod = await importModule();
    expect(mod.getAnthropicModel()).toBe("claude-sonnet-4-5");
  });

  it("ANTHROPIC_MODEL が設定されていればその値を返す", async () => {
    process.env.ANTHROPIC_MODEL = "claude-opus-9-9";
    const mod = await importModule();
    expect(mod.getAnthropicModel()).toBe("claude-opus-9-9");
  });

  it("ANTHROPIC_MODEL が空文字でも process.env の値をそのまま返す（既定にフォールバックしない）", async () => {
    // 仕様: nullish coalescing なので空文字は空文字のまま返る。明示的に固定する。
    process.env.ANTHROPIC_MODEL = "";
    const mod = await importModule();
    expect(mod.getAnthropicModel()).toBe("");
  });
});
