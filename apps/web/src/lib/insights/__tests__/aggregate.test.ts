import { describe, expect, it } from "vitest";
import {
  aggregateByCondition,
  aggregateByPrefecture,
  aggregatePropertiesByBuildingType,
  computeKpis,
  histogramRent,
} from "@/lib/insights/aggregate";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

describe("aggregatePropertiesByBuildingType", () => {
  it("全 buildingType キーを 0 件込みで返す", () => {
    const buckets = aggregatePropertiesByBuildingType(MOCK_PROPERTIES);
    const keys = buckets.map((bucket) => bucket.key);
    expect(keys).toEqual([
      "street_level",
      "building_inline",
      "second_floor_or_above",
      "basement",
      "stand_alone",
      "other",
    ]);
  });

  it("mock データから件数を正しく集計する", () => {
    const buckets = aggregatePropertiesByBuildingType(MOCK_PROPERTIES);
    const counts = Object.fromEntries(buckets.map((bucket) => [bucket.key, bucket.count]));
    expect(counts.street_level).toBe(2);
    expect(counts.building_inline).toBe(1);
    expect(counts.basement).toBe(1);
    expect(counts.second_floor_or_above).toBe(1);
    expect(counts.stand_alone).toBe(0);
    expect(counts.other).toBe(0);
  });

  it("空配列でも全キーを 0 で返す", () => {
    const buckets = aggregatePropertiesByBuildingType([]);
    expect(buckets).toHaveLength(6);
    expect(buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe("aggregateByPrefecture", () => {
  it("出現都道府県だけを件数降順で返す", () => {
    const buckets = aggregateByPrefecture(MOCK_PROPERTIES);
    expect(buckets).toEqual([
      { prefecture: "東京都", count: 3 },
      { prefecture: "大阪府", count: 1 },
      { prefecture: "福岡県", count: 1 },
    ]);
  });

  it("空配列なら空配列を返す", () => {
    expect(aggregateByPrefecture([])).toEqual([]);
  });
});

describe("histogramRent", () => {
  it("デフォルト 50,000 円刻みで mock を集計する", () => {
    const bins = histogramRent(MOCK_PROPERTIES);
    // 最大賃料 680,000 円 → 0..50k から 650k..700k までの 14 bin
    expect(bins).toHaveLength(14);
    expect(bins[0]).toEqual({ min: 0, max: 50_000, count: 0 });
    // 220,000 → index 4 (200,000-250,000)
    const bin220k = bins[4];
    expect(bin220k?.count).toBe(1);
    // 全件カウントの合計は 5 と一致
    const total = bins.reduce((sum, bin) => sum + bin.count, 0);
    expect(total).toBe(MOCK_PROPERTIES.length);
  });

  it("bin 境界（rent === binSize * n）は末尾 bin にクランプされる", () => {
    const props = MOCK_PROPERTIES.slice(0, 1);
    const bins = histogramRent(props, 100_000);
    // rent 580_000 → index 5 (500_000-600_000)
    expect(bins).toHaveLength(6);
    expect(bins[5]?.count).toBe(1);
  });

  it("空配列なら空配列を返す", () => {
    expect(histogramRent([])).toEqual([]);
  });

  it("binSize 0 以下なら例外を投げる", () => {
    expect(() => histogramRent(MOCK_PROPERTIES, 0)).toThrow();
    expect(() => histogramRent(MOCK_PROPERTIES, -1)).toThrow();
  });
});

describe("aggregateByCondition", () => {
  it("全 condition キーを 0 件込みで返す", () => {
    const buckets = aggregateByCondition(MOCK_PROPERTIES);
    expect(buckets.map((bucket) => bucket.key)).toEqual([
      "skeleton",
      "second_hand",
      "transferable_fixtures",
    ]);
  });

  it("mock データから件数を正しく集計する", () => {
    const buckets = aggregateByCondition(MOCK_PROPERTIES);
    const counts = Object.fromEntries(buckets.map((bucket) => [bucket.key, bucket.count]));
    expect(counts.skeleton).toBe(3);
    expect(counts.second_hand).toBe(1);
    expect(counts.transferable_fixtures).toBe(1);
  });
});

describe("computeKpis", () => {
  it("mock データの KPI を計算する", () => {
    const kpis = computeKpis(MOCK_PROPERTIES);
    expect(kpis.total).toBe(5);
    // (580000 + 320000 + 220000 + 430000 + 680000) / 5 = 446000
    expect(kpis.avgRent).toBe(446_000);
    // (38.4 + 24.0 + 18.2 + 33.0 + 56.8) / 5 = 34.08 → 34.1
    expect(kpis.avgArea).toBe(34.1);
    // public: 新宿 / 福岡 / 渋谷 / 港区 = 4 件
    expect(kpis.publishingCount).toBe(4);
  });

  it("空配列なら全 0", () => {
    expect(computeKpis([])).toEqual({
      total: 0,
      avgRent: 0,
      avgArea: 0,
      publishingCount: 0,
    });
  });
});
