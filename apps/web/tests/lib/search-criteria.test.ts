import { describe, expect, it } from "vitest";
import {
  isEmptyCriteria,
  parseSearchCriteria,
  serializeSearchCriteria,
} from "@/lib/search-criteria";

describe("parseSearchCriteria", () => {
  it("空のクエリで EMPTY_CRITERIA 相当を返す", () => {
    const criteria = parseSearchCriteria(new URLSearchParams());
    expect(criteria.buildingTypes).toEqual([]);
    expect(criteria.conditions).toEqual([]);
    expect(criteria.businessCategoryRefs).toEqual([]);
    expect(criteria.prefecture).toBeUndefined();
  });

  it("有効な都道府県を受け入れる", () => {
    const criteria = parseSearchCriteria(new URLSearchParams("prefecture=東京都"));
    expect(criteria.prefecture).toBe("東京都");
  });

  it("不正な都道府県は黙って除外する", () => {
    const criteria = parseSearchCriteria(new URLSearchParams("prefecture=江戸府"));
    expect(criteria.prefecture).toBeUndefined();
  });

  it("整数の rent 範囲を受け入れる", () => {
    const criteria = parseSearchCriteria(new URLSearchParams("minRent=100000&maxRent=500000"));
    expect(criteria.minRent).toBe(100000);
    expect(criteria.maxRent).toBe(500000);
  });

  it("maxRent < minRent のとき maxRent を黙って捨てる", () => {
    const criteria = parseSearchCriteria(new URLSearchParams("minRent=500000&maxRent=100000"));
    expect(criteria.minRent).toBe(500000);
    expect(criteria.maxRent).toBeUndefined();
  });

  it("複数 buildingType を保持し重複は除外する", () => {
    const params = new URLSearchParams();
    params.append("buildingType", "street_level");
    params.append("buildingType", "building_inline");
    params.append("buildingType", "street_level"); // 重複
    params.append("buildingType", "rooftop"); // 不正
    const criteria = parseSearchCriteria(params);
    expect(criteria.buildingTypes).toEqual(["street_level", "building_inline"]);
  });

  it("businessCategoryRefs の許可文字以外を除外する", () => {
    const params = new URLSearchParams();
    params.append("biz", "category-cafe");
    params.append("biz", "invalid id!");
    params.append("biz", "category-bar");
    const criteria = parseSearchCriteria(params);
    expect(criteria.businessCategoryRefs).toEqual(["category-cafe", "category-bar"]);
  });

  it("q の前後空白をトリムし、空文字なら undefined", () => {
    expect(parseSearchCriteria(new URLSearchParams("q=  カフェ ")).q).toBe("カフェ");
    expect(parseSearchCriteria(new URLSearchParams("q=")).q).toBeUndefined();
  });

  it("minArea / maxArea が負値の場合は除外", () => {
    const criteria = parseSearchCriteria(new URLSearchParams("minArea=-1&maxArea=50"));
    expect(criteria.minArea).toBeUndefined();
    expect(criteria.maxArea).toBe(50);
  });
});

describe("serializeSearchCriteria", () => {
  it("空 criteria は空クエリ", () => {
    const params = serializeSearchCriteria({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
    });
    expect(params.toString()).toBe("");
  });

  it("複数値は append で複数回現れる", () => {
    const params = serializeSearchCriteria({
      buildingTypes: ["street_level", "building_inline"],
      conditions: [],
      businessCategoryRefs: ["category-cafe"],
    });
    expect(params.getAll("buildingType")).toEqual(["street_level", "building_inline"]);
    expect(params.getAll("biz")).toEqual(["category-cafe"]);
  });

  it("round-trip: parse -> serialize -> parse が同じ", () => {
    const initial = new URLSearchParams(
      "prefecture=東京都&minRent=100000&maxRent=500000&buildingType=street_level&buildingType=basement&biz=category-cafe&q=新宿",
    );
    const first = parseSearchCriteria(initial);
    const reSerialized = serializeSearchCriteria(first);
    const second = parseSearchCriteria(reSerialized);
    expect(second).toEqual(first);
  });
});

describe("isEmptyCriteria", () => {
  it("空 criteria は true", () => {
    expect(isEmptyCriteria({ buildingTypes: [], conditions: [], businessCategoryRefs: [] })).toBe(
      true,
    );
  });

  it("1 つでも値があれば false", () => {
    expect(
      isEmptyCriteria({
        prefecture: "東京都",
        buildingTypes: [],
        conditions: [],
        businessCategoryRefs: [],
      }),
    ).toBe(false);
  });
});
