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
    expect(criteria.page).toBe(1);
    expect(criteria.pageSize).toBe(20);
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

  describe("page / pageSize", () => {
    it("page=3 / pageSize=50 を読み込む", () => {
      const criteria = parseSearchCriteria(new URLSearchParams("page=3&pageSize=50"));
      expect(criteria.page).toBe(3);
      expect(criteria.pageSize).toBe(50);
    });

    it("page が 0 のときは default(1) にフォールバック", () => {
      const criteria = parseSearchCriteria(new URLSearchParams("page=0"));
      expect(criteria.page).toBe(1);
    });

    it("page が範囲外（10001）のときは default(1) にフォールバック", () => {
      const criteria = parseSearchCriteria(new URLSearchParams("page=10001"));
      expect(criteria.page).toBe(1);
    });

    it("page が文字列のときは default(1)", () => {
      const criteria = parseSearchCriteria(new URLSearchParams("page=abc"));
      expect(criteria.page).toBe(1);
    });

    it("pageSize が下限（10）未満なら default(20)", () => {
      const criteria = parseSearchCriteria(new URLSearchParams("pageSize=5"));
      expect(criteria.pageSize).toBe(20);
    });

    it("pageSize が上限（100）超なら default(20)", () => {
      const criteria = parseSearchCriteria(new URLSearchParams("pageSize=200"));
      expect(criteria.pageSize).toBe(20);
    });
  });
});

describe("serializeSearchCriteria", () => {
  it("空 criteria は空クエリ", () => {
    const params = serializeSearchCriteria({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
      page: 1,
      pageSize: 20,
    });
    expect(params.toString()).toBe("");
  });

  it("複数値は append で複数回現れる", () => {
    const params = serializeSearchCriteria({
      buildingTypes: ["street_level", "building_inline"],
      conditions: [],
      businessCategoryRefs: ["category-cafe"],
      page: 1,
      pageSize: 20,
    });
    expect(params.getAll("buildingType")).toEqual(["street_level", "building_inline"]);
    expect(params.getAll("biz")).toEqual(["category-cafe"]);
  });

  it("page=1 / pageSize=20 はデフォルトなので URL から省く", () => {
    const params = serializeSearchCriteria({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
      page: 1,
      pageSize: 20,
    });
    expect(params.has("page")).toBe(false);
    expect(params.has("pageSize")).toBe(false);
  });

  it("page=2 はクエリに含む / pageSize=50 もクエリに含む", () => {
    const params = serializeSearchCriteria({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
      page: 2,
      pageSize: 50,
    });
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("50");
  });

  it("round-trip: parse -> serialize -> parse が同じ", () => {
    const initial = new URLSearchParams(
      "prefecture=東京都&minRent=100000&maxRent=500000&buildingType=street_level&buildingType=basement&biz=category-cafe&q=新宿&page=2&pageSize=50",
    );
    const first = parseSearchCriteria(initial);
    const reSerialized = serializeSearchCriteria(first);
    const second = parseSearchCriteria(reSerialized);
    expect(second).toEqual(first);
  });
});

describe("isEmptyCriteria", () => {
  it("空 criteria は true", () => {
    expect(
      isEmptyCriteria({
        buildingTypes: [],
        conditions: [],
        businessCategoryRefs: [],
        page: 1,
        pageSize: 20,
      }),
    ).toBe(true);
  });

  it("1 つでも値があれば false", () => {
    expect(
      isEmptyCriteria({
        prefecture: "東京都",
        buildingTypes: [],
        conditions: [],
        businessCategoryRefs: [],
        page: 1,
        pageSize: 20,
      }),
    ).toBe(false);
  });

  it("page=2 でも isEmptyCriteria は false（URL に page=2 が乗るため）", () => {
    expect(
      isEmptyCriteria({
        buildingTypes: [],
        conditions: [],
        businessCategoryRefs: [],
        page: 2,
        pageSize: 20,
      }),
    ).toBe(false);
  });
});
