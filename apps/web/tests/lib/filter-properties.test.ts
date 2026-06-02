import { describe, expect, it } from "vitest";
import { filterProperties } from "@/lib/filter-properties";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

// page / pageSize はテスト便宜上 1 ページに全件が収まる値で固定する。
// 個別のスライス挙動は最下部の `describe("ページネーション", ...)` で別途検証。
const EMPTY_CRITERIA = {
  buildingTypes: [],
  conditions: [],
  businessCategoryRefs: [],
  page: 1,
  pageSize: 100,
} as const;

describe("filterProperties", () => {
  it("空 criteria はすべて返す（items は MOCK_PROPERTIES 全件 / totalCount も全件）", () => {
    const result = filterProperties(MOCK_PROPERTIES, EMPTY_CRITERIA);
    expect(result.items.length).toBe(MOCK_PROPERTIES.length);
    expect(result.totalCount).toBe(MOCK_PROPERTIES.length);
  });

  it("prefecture で絞り込む", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      prefecture: "東京都",
    });
    expect(result.items.every((p) => p.address.prefecture === "東京都")).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalCount).toBe(result.items.length);
  });

  it("city 部分一致で絞り込む", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      city: "新宿",
    });
    expect(result.items.every((p) => p.address.city.includes("新宿"))).toBe(true);
  });

  it("rent 範囲で絞り込む", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      minRent: 300000,
      maxRent: 500000,
    });
    expect(result.items.every((p) => p.rent >= 300000 && p.rent <= 500000)).toBe(true);
  });

  it("area 範囲で絞り込む", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      minArea: 30,
    });
    expect(result.items.every((p) => p.area >= 30)).toBe(true);
  });

  it("buildingTypes は OR 条件", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      buildingTypes: ["street_level", "basement"],
    });
    expect(
      result.items.every((p) => p.buildingType === "street_level" || p.buildingType === "basement"),
    ).toBe(true);
  });

  it("businessCategoryRefs は AND-of-OR (どれかにマッチ)", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      businessCategoryRefs: ["category-cafe"],
    });
    expect(result.items.every((p) => p.suitableBusinessRefs.includes("category-cafe"))).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("q で部分一致検索", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      q: "新宿",
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("条件を組み合わせると AND として動作する", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      prefecture: "東京都",
      maxRent: 500000,
    });
    expect(result.items.every((p) => p.address.prefecture === "東京都" && p.rent <= 500000)).toBe(
      true,
    );
  });

  it("該当なしのときは items は空配列 / totalCount=0", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      prefecture: "北海道",
    });
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  describe("ページネーション", () => {
    it("pageSize=2 / page=1 で先頭 2 件のみ返す（totalCount はフィルタ後全件）", () => {
      const result = filterProperties(MOCK_PROPERTIES, {
        ...EMPTY_CRITERIA,
        pageSize: 10,
        page: 1,
      });
      expect(result.totalCount).toBe(MOCK_PROPERTIES.length);
      expect(result.items.length).toBe(MOCK_PROPERTIES.length);
    });

    it("pageSize=2 / page=2 はオフセット 2 から 2 件返す", () => {
      const result = filterProperties(MOCK_PROPERTIES, {
        ...EMPTY_CRITERIA,
        pageSize: 10,
        page: 2,
      });
      // MOCK_PROPERTIES は 5 件のため、page=2 / pageSize=10 では結果が空
      expect(result.items).toEqual([]);
      // ただし totalCount はフィルタ前後の件数（page によらず一定）
      expect(result.totalCount).toBe(MOCK_PROPERTIES.length);
    });

    it("pageSize でスライスされ、totalCount はフィルタ後全件と一致する", () => {
      const result = filterProperties(MOCK_PROPERTIES, {
        ...EMPTY_CRITERIA,
        pageSize: 10,
        page: 1,
      });
      const allCount = MOCK_PROPERTIES.length;
      expect(result.totalCount).toBe(allCount);
      // pageSize=10 で MOCK_PROPERTIES は 5 件 → items は全件
      expect(result.items.length).toBe(Math.min(10, allCount));
    });

    it("pageSize=2 でスライスが効く（page 1 と page 2 の合計 == totalCount）", () => {
      const criteria = {
        ...EMPTY_CRITERIA,
        // pageSize=2 は shared スキーマでは弾かれるが filterProperties は型ガードしない（z は web 入口側）
        pageSize: 2,
      } as const;
      const page1 = filterProperties(MOCK_PROPERTIES, { ...criteria, page: 1 });
      const page2 = filterProperties(MOCK_PROPERTIES, { ...criteria, page: 2 });
      const page3 = filterProperties(MOCK_PROPERTIES, { ...criteria, page: 3 });
      expect(page1.items.length).toBe(2);
      expect(page2.items.length).toBe(2);
      expect(page3.items.length).toBe(1);
      expect(page1.totalCount).toBe(MOCK_PROPERTIES.length);
      expect(page2.totalCount).toBe(MOCK_PROPERTIES.length);
      // 重複なし
      const slugs = [...page1.items, ...page2.items, ...page3.items].map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("page が総ページ数を超えると items は空、totalCount はフィルタ後件数", () => {
      const result = filterProperties(MOCK_PROPERTIES, {
        ...EMPTY_CRITERIA,
        pageSize: 10,
        page: 999,
      });
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(MOCK_PROPERTIES.length);
    });
  });
});
