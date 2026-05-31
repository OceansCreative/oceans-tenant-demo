import { describe, expect, it } from "vitest";
import { EMPTY_SEARCH_CRITERIA, searchCriteriaSchema } from "./schema.js";

describe("searchCriteriaSchema", () => {
  it("空オブジェクトは EMPTY_SEARCH_CRITERIA と同等", () => {
    const parsed = searchCriteriaSchema.parse({});
    expect(parsed).toEqual(EMPTY_SEARCH_CRITERIA);
  });

  it("全フィールドの正常ケース", () => {
    const parsed = searchCriteriaSchema.parse({
      prefecture: "東京都",
      city: "新宿区",
      minRent: 100000,
      maxRent: 500000,
      minArea: 20,
      maxArea: 100,
      buildingTypes: ["street_level"],
      conditions: ["skeleton"],
      businessCategoryRefs: ["category-cafe"],
      q: "新宿",
    });
    expect(parsed.prefecture).toBe("東京都");
    expect(parsed.buildingTypes).toEqual(["street_level"]);
  });

  it("未知の都道府県は拒否", () => {
    expect(() => searchCriteriaSchema.parse({ prefecture: "江戸府" })).toThrow();
  });

  it("未知の buildingType は拒否", () => {
    expect(() => searchCriteriaSchema.parse({ buildingTypes: ["rooftop"] })).toThrow();
  });

  it("未知の condition は拒否", () => {
    expect(() => searchCriteriaSchema.parse({ conditions: ["brand_new"] })).toThrow();
  });

  it("不正な businessCategoryRefs（記号入り）は拒否", () => {
    expect(() => searchCriteriaSchema.parse({ businessCategoryRefs: ["bad ref!"] })).toThrow();
  });

  it("buildingTypes 11 件超は拒否", () => {
    expect(() =>
      searchCriteriaSchema.parse({
        buildingTypes: Array.from({ length: 11 }, () => "street_level"),
      }),
    ).toThrow();
  });

  it("minRent > maxRent は superRefine で拒否", () => {
    expect(() => searchCriteriaSchema.parse({ minRent: 500000, maxRent: 100000 })).toThrow(
      /minRent は maxRent 以下/,
    );
  });

  it("minArea > maxArea は superRefine で拒否", () => {
    expect(() => searchCriteriaSchema.parse({ minArea: 100, maxArea: 50 })).toThrow(
      /minArea は maxArea 以下/,
    );
  });

  it("rent が小数だと拒否", () => {
    expect(() => searchCriteriaSchema.parse({ minRent: 100.5 })).toThrow();
  });

  it("rent が負だと拒否", () => {
    expect(() => searchCriteriaSchema.parse({ minRent: -1 })).toThrow();
  });

  it("area が 0 だと拒否（positive）", () => {
    expect(() => searchCriteriaSchema.parse({ minArea: 0 })).toThrow();
  });

  it("q が空文字だと拒否（min(1)）", () => {
    expect(() => searchCriteriaSchema.parse({ q: "" })).toThrow();
  });

  it("city が 81 字だと拒否", () => {
    expect(() => searchCriteriaSchema.parse({ city: "あ".repeat(81) })).toThrow();
  });

  it("strict なので未知フィールドは拒否", () => {
    expect(() => searchCriteriaSchema.parse({ unknownField: "x" })).toThrow();
  });

  it("safeParse は失敗時に success=false を返す", () => {
    const result = searchCriteriaSchema.safeParse({ prefecture: "江戸府" });
    expect(result.success).toBe(false);
  });
});
