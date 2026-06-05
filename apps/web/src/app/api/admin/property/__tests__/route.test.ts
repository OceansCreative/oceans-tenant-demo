import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/admin/property` ルートの分岐挙動を検証する。
 *
 * - feature flag 無効時は POST / DELETE ともに 404
 * - feature flag 有効時に POST に valid body を渡すと 200 + mock store に保存
 * - feature flag 有効時に POST に invalid body を渡すと 400（Zod 検証エラー）
 * - feature flag 有効時に DELETE に slug 無し → 400、slug あり → 200
 */

const buildJsonRequest = (
  method: "POST" | "DELETE",
  body: unknown,
  url = "http://localhost/api/admin/property",
): Request =>
  new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const buildValidProperty = () => ({
  title: "API テスト物件",
  slug: "api-test-prop",
  address: {
    prefecture: "東京都",
    city: "新宿区",
    geopoint: { lat: 35.69, lng: 139.7 },
  },
  nearestStations: [],
  rent: 250000,
  area: 22,
  suitableBusinessRefs: [],
  images: [],
  features: [],
  availability: "public",
  listedByRef: "company-001",
  aiMeta: { aiExtracted: false },
  publishedAt: "2026-06-01T00:00:00.000Z",
});

const originalEnv = process.env.NEXT_PUBLIC_ADMIN_ENABLED;

beforeEach(async () => {
  vi.resetModules();
  // mock store を初期化（前テストの副作用を排除）
  const { __resetAdminMockStoreForTesting } = await import("@/lib/admin/mock-store");
  __resetAdminMockStoreForTesting();
});

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.NEXT_PUBLIC_ADMIN_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = originalEnv;
  }
});

describe("POST /api/admin/property", () => {
  it("feature flag 無効時は 404 を返す", async () => {
    delete process.env.NEXT_PUBLIC_ADMIN_ENABLED;
    const { POST } = await import("../route");
    const response = await POST(buildJsonRequest("POST", buildValidProperty()));
    expect(response.status).toBe(404);
  });

  it("feature flag 有効 + valid body で 200 と mode を返す", async () => {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = "true";
    const { POST } = await import("../route");
    const response = await POST(buildJsonRequest("POST", buildValidProperty()));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { status: string; mode: string };
    expect(data.status).toBe("ok");
    expect(data.mode).toBe("mock");
  });

  it("feature flag 有効 + invalid body で 400 を返す", async () => {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = "true";
    const { POST } = await import("../route");
    const response = await POST(buildJsonRequest("POST", { ...buildValidProperty(), rent: -1 }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as {
      status: string;
      fieldErrors?: Record<string, string[]>;
    };
    expect(data.status).toBe("error");
  });

  it("壊れた JSON body は 400 を返す", async () => {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = "true";
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/property", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/admin/property", () => {
  it("feature flag 無効時は 404 を返す", async () => {
    delete process.env.NEXT_PUBLIC_ADMIN_ENABLED;
    const { DELETE } = await import("../route");
    const response = await DELETE(
      buildJsonRequest("DELETE", null, "http://localhost/api/admin/property?slug=foo"),
    );
    expect(response.status).toBe(404);
  });

  it("feature flag 有効 + slug 無しで 400 を返す", async () => {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = "true";
    const { DELETE } = await import("../route");
    const response = await DELETE(buildJsonRequest("DELETE", null));
    expect(response.status).toBe(400);
  });

  it("feature flag 有効 + slug クエリ付きで 200 を返す", async () => {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = "true";
    const { DELETE } = await import("../route");
    const response = await DELETE(
      buildJsonRequest("DELETE", null, "http://localhost/api/admin/property?slug=sample"),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as { status: string; mode: string };
    expect(data.status).toBe("ok");
    expect(data.mode).toBe("mock");
  });

  it("feature flag 有効 + body の slug でも 200 を返す", async () => {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = "true";
    const { DELETE } = await import("../route");
    const response = await DELETE(buildJsonRequest("DELETE", { slug: "sample-bodyform" }));
    expect(response.status).toBe(200);
  });
});
