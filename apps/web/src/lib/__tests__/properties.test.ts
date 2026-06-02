import type { Property } from "@oceans-tenant/shared";
import type { SanityClient } from "@sanity/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `fetchProperties` の env 切替テスト。
 *
 * - env なし → mock 経路（既存テストと同じ動作）
 * - env あり + GROQ 成功 → 実接続経路
 * - env あり + Zod 失敗 → mock fallback + console.error
 * - env あり + 例外 → mock fallback + console.error
 *
 * vi.stubEnv を beforeEach の頭で操作してから `vi.resetModules` → `import` する。
 * これによりモジュール初期化時の env 読みを確実にコントロールできる。
 */

const fetchMock = vi.fn<(groq: string, params: Record<string, unknown>) => Promise<unknown>>();

// `fetchProperties` から使うのは `client.fetch` だけ。完全な SanityClient を生成する代わりに
// `fetch` のみを実装した部分スタブを SanityClient 互換として渡す。
const sanityClientStub = { fetch: fetchMock } as unknown as SanityClient;

vi.mock("@/lib/sanity/client", () => ({
  getSanityClient: vi.fn<() => SanityClient | null>(() => null),
}));

import { getSanityClient } from "@/lib/sanity/client";

const getSanityClientMock = vi.mocked(getSanityClient);

const VALID_PROPERTY: Property = {
  title: "テスト物件",
  slug: "test-property",
  address: {
    prefecture: "東京都",
    city: "新宿区",
    streetAddress: "新宿 1-1-1",
    geopoint: { lat: 35.69, lng: 139.7 },
  },
  nearestStations: [],
  rent: 200000,
  area: 20.0,
  buildingType: "street_level",
  condition: "skeleton",
  suitableBusinessRefs: [],
  images: [],
  features: [],
  availability: "public",
  listedByRef: "company-test",
  aiMeta: { aiExtracted: false },
  publishedAt: "2026-05-01T00:00:00.000Z",
};

const EMPTY_CRITERIA = {
  buildingTypes: [],
  conditions: [],
  businessCategoryRefs: [],
  page: 1,
  pageSize: 100,
} as const;

beforeEach(() => {
  fetchMock.mockReset();
  getSanityClientMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fetchProperties — env 未設定 (mock 経路)", () => {
  it("env が無いとき MOCK_PROPERTIES を filter した結果を返す", async () => {
    getSanityClientMock.mockReturnValue(null);
    const { fetchProperties } = await import("@/lib/properties");
    const result = await fetchProperties(EMPTY_CRITERIA);
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    // 実 fetch は走らない
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefecture フィルタが mock 経路でも効く（既存挙動の維持）", async () => {
    getSanityClientMock.mockReturnValue(null);
    const { fetchProperties } = await import("@/lib/properties");
    const result = await fetchProperties({ ...EMPTY_CRITERIA, prefecture: "東京都" });
    expect(result.items.every((p) => p.address.prefecture === "東京都")).toBe(true);
  });
});

describe("fetchProperties — env 設定済み (実接続経路)", () => {
  beforeEach(() => {
    getSanityClientMock.mockReturnValue(sanityClientStub);
  });

  it("GROQ 成功時は propertySchema 検証を通った items + count を返す", async () => {
    fetchMock.mockImplementation(async (groq) => {
      if (groq.startsWith("count(")) return 42;
      return [VALID_PROPERTY];
    });

    const { fetchProperties } = await import("@/lib/properties");
    const result = await fetchProperties(EMPTY_CRITERIA);

    expect(result.totalCount).toBe(42);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.slug).toBe("test-property");
    // tsubo が derive されている
    expect(result.items[0]?.tsubo).toBeGreaterThan(0);
    // 一覧クエリと count クエリで合計 2 回
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("一覧 GROQ と count GROQ は同じ params を共有する（フィルタ条件のドリフト防止）", async () => {
    fetchMock.mockImplementation(async (groq) => {
      if (groq.startsWith("count(")) return 1;
      return [VALID_PROPERTY];
    });
    const { fetchProperties } = await import("@/lib/properties");
    await fetchProperties({
      ...EMPTY_CRITERIA,
      prefecture: "東京都",
      minRent: 100000,
    });

    const calls = fetchMock.mock.calls;
    expect(calls).toHaveLength(2);
    const listParams = calls.find(([groq]) => !groq.startsWith("count("))?.[1];
    const countParams = calls.find(([groq]) => groq.startsWith("count("))?.[1];
    expect(listParams).toBeDefined();
    expect(countParams).toBeDefined();
    // 共通フィルタ params の照合（limit / offset は一覧のみに存在）
    expect(listParams?.prefecture).toBe("東京都");
    expect(listParams?.minRent).toBe(100000);
    expect(countParams?.prefecture).toBe("東京都");
    expect(countParams?.minRent).toBe(100000);
  });

  it("page / pageSize から limit / offset が一覧 GROQ に流れる", async () => {
    fetchMock.mockImplementation(async (groq) => {
      if (groq.startsWith("count(")) return 0;
      return [];
    });
    const { fetchProperties } = await import("@/lib/properties");
    await fetchProperties({ ...EMPTY_CRITERIA, page: 3, pageSize: 25 });

    const listCall = fetchMock.mock.calls.find(([groq]) => !groq.startsWith("count("));
    expect(listCall?.[1]?.limit).toBe(25);
    expect(listCall?.[1]?.offset).toBe(50);
  });

  it("Zod 検証失敗時は mock fallback + console.error", async () => {
    const errorSpy = vi.spyOn(console, "error");
    fetchMock.mockImplementation(async (groq) => {
      if (groq.startsWith("count(")) return 100;
      // shape が違うレスポンス（rent が文字列）
      return [{ ...VALID_PROPERTY, rent: "broken" }];
    });

    const { fetchProperties } = await import("@/lib/properties");
    const result = await fetchProperties(EMPTY_CRITERIA);

    // mock fallback の totalCount は MOCK_PROPERTIES 由来 (5件)
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.totalCount).not.toBe(100);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("count が整数でなければ mock fallback + console.error", async () => {
    const errorSpy = vi.spyOn(console, "error");
    fetchMock.mockImplementation(async (groq) => {
      if (groq.startsWith("count(")) return "broken";
      return [VALID_PROPERTY];
    });

    const { fetchProperties } = await import("@/lib/properties");
    const result = await fetchProperties(EMPTY_CRITERIA);

    expect(result.totalCount).not.toBe("broken");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("レスポンスが配列でなければ mock fallback（items は MOCK_PROPERTIES 由来）", async () => {
    fetchMock.mockImplementation(async (groq) => {
      if (groq.startsWith("count(")) return 9999;
      return { not: "array" };
    });

    const { fetchProperties } = await import("@/lib/properties");
    const result = await fetchProperties(EMPTY_CRITERIA);

    // fallback の totalCount は MOCK_PROPERTIES の件数になる（9999 ではない）
    expect(result.totalCount).not.toBe(9999);
    expect(result.items.length).toBeGreaterThan(0);
    // mock 由来の slug プレフィックスを持つ
    expect(result.items.every((p) => p.slug.startsWith("sample-"))).toBe(true);
  });

  it("client.fetch が例外を投げても mock fallback + console.error で死活を守る", async () => {
    const errorSpy = vi.spyOn(console, "error");
    fetchMock.mockRejectedValue(new Error("network down"));

    const { fetchProperties } = await import("@/lib/properties");
    const result = await fetchProperties(EMPTY_CRITERIA);

    expect(result.totalCount).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("findRelatedProperties — 関連物件スコアリング", () => {
  it("現物件自身は結果に含めない", async () => {
    const { findRelatedProperties } = await import("@/lib/properties");
    const { MOCK_PROPERTIES } = await import("@/lib/sanity/mock-properties");
    const current = MOCK_PROPERTIES[0];
    if (!current) throw new Error("mock empty");
    const result = findRelatedProperties(current, MOCK_PROPERTIES, 3);
    expect(result.every((p) => p.slug !== current.slug)).toBe(true);
  });

  it("同じ都道府県の物件が上位に来る（prefecture +3 スコア）", async () => {
    const { findRelatedProperties } = await import("@/lib/properties");
    const { MOCK_PROPERTIES } = await import("@/lib/sanity/mock-properties");
    // 新宿三丁目（東京都, street_level, [cafe, bar]）を current にしたとき、
    // 渋谷（東京都=3, business overlap=1）= 4 が最上位スコアになる
    const current = MOCK_PROPERTIES.find((p) => p.slug === "sample-shinjuku-sanchome-street");
    if (!current) throw new Error("expected mock");
    const result = findRelatedProperties(current, MOCK_PROPERTIES, 1);
    expect(result.length).toBe(1);
    expect(result[0]?.slug).toBe("sample-shibuya-basement-bar");
  });

  it("buildingType 一致でスコアが加算される", async () => {
    const { findRelatedProperties } = await import("@/lib/properties");
    const { MOCK_PROPERTIES } = await import("@/lib/sanity/mock-properties");
    // 福岡県の路面店 — 同じ buildingType=street_level の新宿三丁目（東京都）が候補に入る
    const current = MOCK_PROPERTIES.find((p) => p.slug === "sample-fukuoka-chuoku-street");
    if (!current) throw new Error("expected mock");
    const result = findRelatedProperties(current, MOCK_PROPERTIES, 3);
    // 新宿の路面店（buildingType=street_level + 業種カフェ一致）が最上位
    expect(result[0]?.slug).toBe("sample-shinjuku-sanchome-street");
  });

  it("suitableBusinessRefs 重複でスコアが加算される", async () => {
    const { findRelatedProperties } = await import("@/lib/properties");
    const current: typeof VALID_PROPERTY = {
      ...VALID_PROPERTY,
      slug: "current",
      address: {
        ...VALID_PROPERTY.address,
        prefecture: "北海道",
      },
      buildingType: "second_floor_or_above",
      suitableBusinessRefs: ["category-bar"],
    };
    const matchingBar: typeof VALID_PROPERTY = {
      ...VALID_PROPERTY,
      slug: "matching-bar",
      address: { ...VALID_PROPERTY.address, prefecture: "大阪府" },
      buildingType: "basement",
      suitableBusinessRefs: ["category-bar", "category-restaurant"],
    };
    const unrelated: typeof VALID_PROPERTY = {
      ...VALID_PROPERTY,
      slug: "unrelated",
      address: { ...VALID_PROPERTY.address, prefecture: "福岡県" },
      buildingType: "street_level",
      suitableBusinessRefs: ["category-office"],
    };
    const { derivePropertyTsubo } = await import("@oceans-tenant/shared");
    const pool = [current, matchingBar, unrelated].map(derivePropertyTsubo);
    const [c, ...rest] = pool;
    if (!c) throw new Error("");
    const result = findRelatedProperties(c, pool, 2);
    expect(result[0]?.slug).toBe("matching-bar");
    expect(result.length).toBe(2);
    expect(rest.length).toBe(2);
  });

  it("limit が 0 のとき空配列を返す", async () => {
    const { findRelatedProperties } = await import("@/lib/properties");
    const { MOCK_PROPERTIES } = await import("@/lib/sanity/mock-properties");
    const current = MOCK_PROPERTIES[0];
    if (!current) throw new Error("");
    expect(findRelatedProperties(current, MOCK_PROPERTIES, 0)).toEqual([]);
  });

  it("pool が現物件のみのとき空配列を返す", async () => {
    const { findRelatedProperties } = await import("@/lib/properties");
    const { MOCK_PROPERTIES } = await import("@/lib/sanity/mock-properties");
    const current = MOCK_PROPERTIES[0];
    if (!current) throw new Error("");
    expect(findRelatedProperties(current, [current], 3)).toEqual([]);
  });

  it("スコア 0 の候補も publishedAt 降順で limit まで埋める（フォールバック）", async () => {
    const { findRelatedProperties } = await import("@/lib/properties");
    const { derivePropertyTsubo } = await import("@oceans-tenant/shared");
    // すべて異なる prefecture / 業種 / buildingType → スコアは全員 0
    const current = derivePropertyTsubo({
      ...VALID_PROPERTY,
      slug: "current",
      address: { ...VALID_PROPERTY.address, prefecture: "北海道" },
      buildingType: "street_level",
      suitableBusinessRefs: ["category-cafe"],
    });
    const older = derivePropertyTsubo({
      ...VALID_PROPERTY,
      slug: "older",
      address: { ...VALID_PROPERTY.address, prefecture: "大阪府" },
      buildingType: "second_floor_or_above",
      suitableBusinessRefs: ["category-office"],
      publishedAt: "2025-01-01T00:00:00.000Z",
    });
    const newer = derivePropertyTsubo({
      ...VALID_PROPERTY,
      slug: "newer",
      address: { ...VALID_PROPERTY.address, prefecture: "福岡県" },
      buildingType: "basement",
      suitableBusinessRefs: ["category-clinic"],
      publishedAt: "2026-05-01T00:00:00.000Z",
    });
    const result = findRelatedProperties(current, [current, older, newer], 2);
    expect(result.length).toBe(2);
    // publishedAt 降順なので newer が先頭
    expect(result[0]?.slug).toBe("newer");
    expect(result[1]?.slug).toBe("older");
  });
});
