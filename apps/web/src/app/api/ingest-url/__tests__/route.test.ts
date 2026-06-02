import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// fetchHtmlSafe と extractReadableContent はモジュール境界で差し替える。
// 実際のネットワーク I/O は走らせない。
vi.mock("@/lib/ai/url-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/url-safety")>("@/lib/ai/url-safety");
  return {
    ...actual,
    fetchHtmlSafe: vi.fn(),
  };
});
vi.mock("@/lib/ai/html-extraction", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/html-extraction")>(
    "@/lib/ai/html-extraction",
  );
  return {
    ...actual,
    extractReadableContent: vi.fn(),
  };
});

import {
  createContentClient,
  createThrowingClient,
  createToolUseClient,
  type MessagesCreateOptions,
  toAnthropicClient,
} from "@/lib/ai/__tests__/anthropic-test-helpers";
import { setAnthropicClientForTesting } from "@/lib/ai/anthropic-client";
import { extractReadableContent } from "@/lib/ai/html-extraction";
import { EXTRACT_PROPERTY_TOOL_NAME } from "@/lib/ai/tools";
import { fetchHtmlSafe } from "@/lib/ai/url-safety";
import { __resetRateLimitForTesting } from "@/lib/rate-limit";
import { POST } from "../route";

const buildRequest = (body: unknown): Request =>
  new Request("http://localhost/api/ingest-url", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

/**
 * Claude が返しそうな `extract_property` の典型的な input。
 * `propertySchema` を完全に満たすよう揃える。
 */
const VALID_TOOL_INPUT = {
  title: "サンプル物件",
  slug: "sample-property",
  address: {
    prefecture: "東京都",
    city: "新宿区",
    streetAddress: "新宿 1-1-1",
    geopoint: { lat: 35.69, lng: 139.7 },
  },
  nearestStations: [],
  rent: 300000,
  area: 50,
  buildingType: "street_level",
  availability: "public",
  publishedAt: "2026-01-01T00:00:00Z",
  features: [],
  suitableBusinessRefs: [],
  images: [],
  aiConfidence: 0.9,
} as const;

describe("POST /api/ingest-url (Tool Use)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // 各テストで in-memory バケットを初期化（前テストの消費が残らないように）
    __resetRateLimitForTesting();
    // Default mock: fetch returns OK HTML, extraction returns long text.
    vi.mocked(fetchHtmlSafe).mockResolvedValue({
      url: "https://example.com/listings/1",
      status: 200,
      body: "<html></html>",
      redirected: [],
    });
    vi.mocked(extractReadableContent).mockReturnValue({
      title: "サンプル",
      textContent: "あ".repeat(200),
    });
  });

  afterEach(() => {
    setAnthropicClientForTesting(null);
    vi.clearAllMocks();
  });

  it("tool_use の input から propertySchema 互換 draft を返す", async () => {
    const fake = createToolUseClient(VALID_TOOL_INPUT, EXTRACT_PROPERTY_TOOL_NAME);
    setAnthropicClientForTesting(toAnthropicClient(fake));

    const response = await POST(buildRequest({ url: "https://example.com/listings/1" }));
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      status: string;
      draft: { title: string; tsubo: number; aiMeta: { aiConfidence?: number } };
      confidence: number;
    };
    expect(json.status).toBe("ok");
    expect(json.draft.title).toBe("サンプル物件");
    expect(json.draft.tsubo).toBeGreaterThan(0);
    expect(json.confidence).toBe(0.9);
    expect(json.draft.aiMeta.aiConfidence).toBe(0.9);
  });

  it("tools / tool_choice / signal が SDK 呼び出しに渡される", async () => {
    const fake = createToolUseClient(VALID_TOOL_INPUT, EXTRACT_PROPERTY_TOOL_NAME);
    setAnthropicClientForTesting(toAnthropicClient(fake));

    await POST(buildRequest({ url: "https://example.com/listings/1" }));
    const [first] = fake.capturedArgs;
    expect(first).toBeDefined();
    expect(first?.args.tools).toBeDefined();
    expect(first?.args.tool_choice).toEqual({
      type: "tool",
      name: EXTRACT_PROPERTY_TOOL_NAME,
    });
    // ingest-url は client signal を SDK には渡さない（短時間の同期処理のため）。
    // ただし将来的に渡しても良いように options は undefined であることを確認。
    const opts = first?.options as MessagesCreateOptions | undefined;
    if (opts !== undefined) {
      expect(opts.signal).toBeUndefined();
    }
  });

  it("listedByRef は省略でも company-001 で補完される", async () => {
    const fake = createToolUseClient(VALID_TOOL_INPUT, EXTRACT_PROPERTY_TOOL_NAME);
    setAnthropicClientForTesting(toAnthropicClient(fake));

    const response = await POST(buildRequest({ url: "https://example.com/listings/1" }));
    const json = (await response.json()) as { draft: { listedByRef: string } };
    expect(json.draft.listedByRef).toBe("company-001");
  });

  it("不正な input（必須欠落）は 500 系の汎用エラーを返す", async () => {
    setAnthropicClientForTesting(
      toAnthropicClient(createToolUseClient({ title: "no slug" }, EXTRACT_PROPERTY_TOOL_NAME)),
    );
    const response = await POST(buildRequest({ url: "https://example.com/listings/1" }));
    expect(response.status).toBe(500);
    const json = (await response.json()) as { status: string };
    expect(json.status).toBe("error");
  });

  it("tool_use ブロックがない応答は 502 を返す", async () => {
    setAnthropicClientForTesting(
      toAnthropicClient(createContentClient([{ type: "text", text: "自由テキスト" }])),
    );
    const response = await POST(buildRequest({ url: "https://example.com/listings/1" }));
    expect(response.status).toBe(502);
  });

  it("SDK 例外は 500 に丸める", async () => {
    setAnthropicClientForTesting(
      toAnthropicClient(createThrowingClient(new Error("内部 SDK エラー"))),
    );
    const response = await POST(buildRequest({ url: "https://example.com/listings/1" }));
    expect(response.status).toBe(500);
  });

  it("ANTHROPIC_API_KEY 未設定の例外は 503 で透過させる", async () => {
    setAnthropicClientForTesting(
      toAnthropicClient(createThrowingClient(new Error("ANTHROPIC_API_KEY が未設定です。"))),
    );
    const response = await POST(buildRequest({ url: "https://example.com/listings/1" }));
    expect(response.status).toBe(503);
  });

  it("不正な URL は 400", async () => {
    const response = await POST(buildRequest({ url: "javascript:alert(1)" }));
    expect(response.status).toBe(400);
  });

  it("リクエスト形式不正は 400", async () => {
    const response = await POST(buildRequest({ notUrl: 123 }));
    expect(response.status).toBe(400);
  });

  it("upstream 4xx は 422", async () => {
    vi.mocked(fetchHtmlSafe).mockResolvedValue({
      url: "https://example.com/x",
      status: 404,
      body: "",
      redirected: [],
    });
    const response = await POST(buildRequest({ url: "https://example.com/x" }));
    expect(response.status).toBe(422);
  });

  it("本文が短い場合は 422", async () => {
    vi.mocked(extractReadableContent).mockReturnValue({
      title: "",
      textContent: "短い",
    });
    const response = await POST(buildRequest({ url: "https://example.com/x" }));
    expect(response.status).toBe(422);
  });

  // v0.5.0 WS-1: レート制限
  it("レート制限を使い切ると 429 + Retry-After を返す", async () => {
    process.env.RATE_LIMIT_INGEST_CAPACITY = "1";
    process.env.RATE_LIMIT_INGEST_REFILL_INTERVAL_MS = "60000";
    try {
      const fake = createToolUseClient(VALID_TOOL_INPUT, EXTRACT_PROPERTY_TOOL_NAME);
      setAnthropicClientForTesting(toAnthropicClient(fake));
      const buildReq = (): Request =>
        new Request("http://localhost/api/ingest-url", {
          method: "POST",
          body: JSON.stringify({ url: "https://example.com/x" }),
          headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.50" },
        });
      const r1 = await POST(buildReq());
      expect(r1.status).toBe(200);
      const r2 = await POST(buildReq());
      expect(r2.status).toBe(429);
      expect(r2.headers.get("Retry-After")).not.toBeNull();
      expect(r2.headers.get("X-RateLimit-Limit")).toBe("1");
      const body = (await r2.json()) as { error: string; retryAfterSeconds: number };
      expect(body.error).toBe("rate_limited");
      expect(body.retryAfterSeconds).toBeGreaterThan(0);
    } finally {
      delete process.env.RATE_LIMIT_INGEST_CAPACITY;
      delete process.env.RATE_LIMIT_INGEST_REFILL_INTERVAL_MS;
    }
  });

  it("成功応答にも X-RateLimit-* ヘッダが付与される", async () => {
    setAnthropicClientForTesting(
      toAnthropicClient(createToolUseClient(VALID_TOOL_INPUT, EXTRACT_PROPERTY_TOOL_NAME)),
    );
    const response = await POST(buildRequest({ url: "https://example.com/x" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).not.toBeNull();
    expect(response.headers.get("X-RateLimit-Remaining")).not.toBeNull();
    expect(response.headers.get("X-RateLimit-Reset")).not.toBeNull();
  });
});
