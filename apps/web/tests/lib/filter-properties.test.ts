import { describe, expect, it } from "vitest";
import { filterProperties } from "@/lib/filter-properties";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

const EMPTY_CRITERIA = {
  buildingTypes: [],
  conditions: [],
  businessCategoryRefs: [],
};

describe("filterProperties", () => {
  it("空 criteria はすべて返す", () => {
    const result = filterProperties(MOCK_PROPERTIES, EMPTY_CRITERIA);
    expect(result.length).toBe(MOCK_PROPERTIES.length);
  });

  it("prefecture で絞り込む", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      prefecture: "東京都",
    });
    expect(result.every((p) => p.address.prefecture === "東京都")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("city 部分一致で絞り込む", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      city: "新宿",
    });
    expect(result.every((p) => p.address.city.includes("新宿"))).toBe(true);
  });

  it("rent 範囲で絞り込む", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      minRent: 300000,
      maxRent: 500000,
    });
    expect(result.every((p) => p.rent >= 300000 && p.rent <= 500000)).toBe(true);
  });

  it("area 範囲で絞り込む", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      minArea: 30,
    });
    expect(result.every((p) => p.area >= 30)).toBe(true);
  });

  it("buildingTypes は OR 条件", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      buildingTypes: ["street_level", "basement"],
    });
    expect(
      result.every((p) => p.buildingType === "street_level" || p.buildingType === "basement"),
    ).toBe(true);
  });

  it("businessCategoryRefs は AND-of-OR (どれかにマッチ)", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      businessCategoryRefs: ["category-cafe"],
    });
    expect(result.every((p) => p.suitableBusinessRefs.includes("category-cafe"))).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("q で部分一致検索", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      q: "新宿",
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it("条件を組み合わせると AND として動作する", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      prefecture: "東京都",
      maxRent: 500000,
    });
    expect(result.every((p) => p.address.prefecture === "東京都" && p.rent <= 500000)).toBe(true);
  });

  it("該当なしのときは空配列", () => {
    const result = filterProperties(MOCK_PROPERTIES, {
      ...EMPTY_CRITERIA,
      prefecture: "北海道",
    });
    expect(result).toEqual([]);
  });
});
