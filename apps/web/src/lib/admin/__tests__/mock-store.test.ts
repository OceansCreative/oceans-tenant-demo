import type { Property } from "@oceans-tenant/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import {
  __resetAdminMockStoreForTesting,
  deleteMockProperty,
  getMockPropertyBySlug,
  listMockProperties,
  upsertMockProperty,
} from "../mock-store";

/**
 * Admin mock store のユニットテスト。
 *
 * - 初期データは MOCK_PROPERTIES から複製される（書き換え不可な原本に影響しない）
 * - upsert は slug 主キーで上書き
 * - delete は存在する場合だけ true
 * - propertySchema 検証に失敗する入力は throw
 */

const buildValidProperty = (overrides: Partial<Property> = {}): Property => ({
  title: "テスト物件",
  slug: "test-property-new",
  address: {
    prefecture: "東京都",
    city: "千代田区",
    geopoint: { lat: 35.681, lng: 139.767 },
  },
  nearestStations: [],
  rent: 200000,
  area: 20,
  suitableBusinessRefs: [],
  images: [],
  features: [],
  availability: "public",
  listedByRef: "company-001",
  aiMeta: { aiExtracted: false },
  publishedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  __resetAdminMockStoreForTesting();
});

describe("listMockProperties", () => {
  it("初期状態で MOCK_PROPERTIES と同数を返す", () => {
    const all = listMockProperties();
    expect(all.length).toBe(MOCK_PROPERTIES.length);
  });

  it("publishedAt 降順で並んでいる", () => {
    const all = listMockProperties();
    for (let i = 1; i < all.length; i += 1) {
      const prev = all[i - 1];
      const cur = all[i];
      if (!prev || !cur) continue;
      expect(prev.publishedAt >= cur.publishedAt).toBe(true);
    }
  });

  it("返却される property は `tsubo` を含まない（保存対象外）", () => {
    const all = listMockProperties();
    for (const p of all) {
      expect("tsubo" in p).toBe(false);
    }
  });
});

describe("getMockPropertyBySlug", () => {
  it("存在する slug を返す", () => {
    const first = MOCK_PROPERTIES[0];
    if (!first) throw new Error("MOCK_PROPERTIES is empty");
    expect(getMockPropertyBySlug(first.slug)?.title).toBe(first.title);
  });

  it("存在しない slug は null", () => {
    expect(getMockPropertyBySlug("non-existent")).toBeNull();
  });
});

describe("upsertMockProperty", () => {
  it("新規 property を追加できる", () => {
    const before = listMockProperties().length;
    const input = buildValidProperty();
    const saved = upsertMockProperty(input);
    expect(saved.slug).toBe(input.slug);
    expect(listMockProperties().length).toBe(before + 1);
    expect(getMockPropertyBySlug(input.slug)).not.toBeNull();
  });

  it("既存 slug を upsert すると上書きされる", () => {
    const first = MOCK_PROPERTIES[0];
    if (!first) throw new Error("MOCK_PROPERTIES is empty");
    const before = listMockProperties().length;
    upsertMockProperty(buildValidProperty({ slug: first.slug, title: "上書きタイトル" }));
    expect(listMockProperties().length).toBe(before); // 件数は変わらない
    expect(getMockPropertyBySlug(first.slug)?.title).toBe("上書きタイトル");
  });

  it("検証エラーを投げる（rent が負）", () => {
    expect(() => upsertMockProperty(buildValidProperty({ rent: -100 }))).toThrow();
  });

  it("検証エラーを投げる（slug 形式不正）", () => {
    expect(() => upsertMockProperty(buildValidProperty({ slug: "Invalid Slug" }))).toThrow();
  });
});

describe("deleteMockProperty", () => {
  it("存在する slug を削除して true を返す", () => {
    const first = MOCK_PROPERTIES[0];
    if (!first) throw new Error("MOCK_PROPERTIES is empty");
    expect(deleteMockProperty(first.slug)).toBe(true);
    expect(getMockPropertyBySlug(first.slug)).toBeNull();
  });

  it("存在しない slug は false", () => {
    expect(deleteMockProperty("non-existent")).toBe(false);
  });
});
