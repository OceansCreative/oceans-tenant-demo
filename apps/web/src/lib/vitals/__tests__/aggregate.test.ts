import { describe, expect, it } from "vitest";
import {
  buildBucketKey,
  median,
  p75,
  parseBucketKey,
  summarizeAllSamples,
  summarizeSamples,
} from "../aggregate";
import { rateVitalsValue } from "../types";

describe("median", () => {
  it("空配列は 0 を返す（呼び出し側で除外している前提でも安全側に倒す）", () => {
    expect(median([])).toBe(0);
  });

  it("奇数件はど真ん中の値を返す", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("偶数件は中央 2 要素の平均を返す", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("負値や 0 を含むサンプルでも sort された前提で計算する", () => {
    expect(median([0, -1, 2, 3])).toBe(1);
  });
});

describe("p75", () => {
  it("空配列は 0 を返す", () => {
    expect(p75([])).toBe(0);
  });

  it("1 件のみのときはその値を返す", () => {
    expect(p75([100])).toBe(100);
  });

  it("4 件のときは nearest-rank で上位 25% 番目（rank=3, index=2）", () => {
    // sorted: [10, 20, 30, 40]
    // rank = ceil(4 * 0.75) = 3 → index=2 → 30
    expect(p75([10, 20, 30, 40])).toBe(30);
  });

  it("10 件のときは rank=8, index=7", () => {
    // sorted: [1..10] → rank=ceil(7.5)=8 → index=7 → 8
    expect(p75([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(8);
  });

  it("全件同じ値なら p75 もその値", () => {
    expect(p75([5, 5, 5, 5])).toBe(5);
  });
});

describe("summarizeSamples", () => {
  it("空配列は null を返す", () => {
    expect(summarizeSamples("LCP", "/", [])).toBeNull();
  });

  it("metric / path / sampleCount / median / p75 を計算して返す", () => {
    const samples = [
      { value: 1000, timestamp: 1 },
      { value: 2000, timestamp: 2 },
      { value: 3000, timestamp: 3 },
      { value: 4000, timestamp: 4 },
    ];
    expect(summarizeSamples("LCP", "/search", samples)).toEqual({
      metric: "LCP",
      path: "/search",
      sampleCount: 4,
      median: 2500,
      p75: 3000,
    });
  });
});

describe("summarizeAllSamples", () => {
  it("metric 宣言順（LCP→INP→CLS→FCP→TTFB）と path 昇順で安定ソートする", () => {
    const buckets = new Map([
      [buildBucketKey("TTFB", "/"), [{ value: 100, timestamp: 0 }]],
      [buildBucketKey("LCP", "/zzz"), [{ value: 200, timestamp: 0 }]],
      [buildBucketKey("LCP", "/aaa"), [{ value: 300, timestamp: 0 }]],
      [buildBucketKey("INP", "/"), [{ value: 50, timestamp: 0 }]],
    ]);
    const result = summarizeAllSamples(buckets);
    expect(result.map((s) => ({ metric: s.metric, path: s.path }))).toEqual([
      { metric: "LCP", path: "/aaa" },
      { metric: "LCP", path: "/zzz" },
      { metric: "INP", path: "/" },
      { metric: "TTFB", path: "/" },
    ]);
  });

  it("空 Map のときは空配列を返す", () => {
    expect(summarizeAllSamples(new Map())).toEqual([]);
  });

  it("未知の metric prefix を持つキーは静かに無視する", () => {
    const buckets = new Map([
      ["UNKNOWN:/", [{ value: 999, timestamp: 0 }]],
      [buildBucketKey("LCP", "/"), [{ value: 1, timestamp: 0 }]],
    ]);
    const result = summarizeAllSamples(buckets);
    expect(result).toHaveLength(1);
    expect(result[0]?.metric).toBe("LCP");
  });
});

describe("parseBucketKey / buildBucketKey", () => {
  it("round-trip できる", () => {
    const key = buildBucketKey("LCP", "/properties/abc");
    expect(parseBucketKey(key)).toEqual({ metric: "LCP", path: "/properties/abc" });
  });

  it("path 側にコロンが含まれていても、最初の 1 つ目だけで分割する", () => {
    // 通常はあり得ないが、防御的に
    expect(parseBucketKey("LCP:/a:b:c")).toEqual({ metric: "LCP", path: "/a:b:c" });
  });

  it("コロン無し / 不正な形式は null を返す", () => {
    expect(parseBucketKey("LCP")).toBeNull();
    expect(parseBucketKey(":/")).toBeNull();
    expect(parseBucketKey("LCP:")).toBeNull();
  });

  it("未知の metric は null を返す", () => {
    expect(parseBucketKey("XYZ:/")).toBeNull();
  });
});

describe("rateVitalsValue", () => {
  it("LCP の境界値を good/needsImprovement/poor に分類する", () => {
    expect(rateVitalsValue("LCP", 2500)).toBe("good");
    expect(rateVitalsValue("LCP", 2501)).toBe("needsImprovement");
    expect(rateVitalsValue("LCP", 4000)).toBe("needsImprovement");
    expect(rateVitalsValue("LCP", 4001)).toBe("poor");
  });

  it("CLS は無次元で 0.1 / 0.25 を境界とする", () => {
    expect(rateVitalsValue("CLS", 0.1)).toBe("good");
    expect(rateVitalsValue("CLS", 0.15)).toBe("needsImprovement");
    expect(rateVitalsValue("CLS", 0.5)).toBe("poor");
  });

  it("INP / FCP / TTFB も閾値テーブル通りに分類する", () => {
    expect(rateVitalsValue("INP", 200)).toBe("good");
    expect(rateVitalsValue("INP", 600)).toBe("poor");
    expect(rateVitalsValue("FCP", 1800)).toBe("good");
    expect(rateVitalsValue("FCP", 3500)).toBe("poor");
    expect(rateVitalsValue("TTFB", 800)).toBe("good");
    expect(rateVitalsValue("TTFB", 2000)).toBe("poor");
  });
});
