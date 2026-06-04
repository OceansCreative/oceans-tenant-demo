import { beforeEach, describe, expect, it } from "vitest";
import {
  __getVitalsBucketsForTesting,
  __resetVitalsStoreForTesting,
  getAllVitalsSummary,
  getMaxSamplesPerKey,
  recordVitalsSample,
} from "../store";

describe("vitals store", () => {
  beforeEach(() => {
    __resetVitalsStoreForTesting();
  });

  it("最初のサンプル追加でバケットが作られる", () => {
    recordVitalsSample("LCP", "/", 1234, 1);
    const buckets = __getVitalsBucketsForTesting();
    expect(buckets.size).toBe(1);
    expect(buckets.get("LCP:/")).toEqual([{ value: 1234, timestamp: 1 }]);
  });

  it("同じ key へのサンプルは push される", () => {
    recordVitalsSample("LCP", "/search", 100, 1);
    recordVitalsSample("LCP", "/search", 200, 2);
    const buckets = __getVitalsBucketsForTesting();
    expect(buckets.get("LCP:/search")).toEqual([
      { value: 100, timestamp: 1 },
      { value: 200, timestamp: 2 },
    ]);
  });

  it("metric / path が違えば別 key になる", () => {
    recordVitalsSample("LCP", "/", 100);
    recordVitalsSample("INP", "/", 50);
    recordVitalsSample("LCP", "/search", 200);
    const buckets = __getVitalsBucketsForTesting();
    expect(buckets.size).toBe(3);
  });

  it("上限超過時は古いサンプルから FIFO で evict される", () => {
    const cap = getMaxSamplesPerKey();
    // 上限ぴったり詰める
    for (let i = 0; i < cap; i += 1) {
      recordVitalsSample("LCP", "/", i, i);
    }
    // この時点で 1000 件、先頭は { value: 0 }
    expect(__getVitalsBucketsForTesting().get("LCP:/")?.length).toBe(cap);
    expect(__getVitalsBucketsForTesting().get("LCP:/")?.[0]?.value).toBe(0);

    // 1 件追加 → 先頭が捨てられる
    recordVitalsSample("LCP", "/", 9999, 9999);
    const after = __getVitalsBucketsForTesting().get("LCP:/");
    expect(after?.length).toBe(cap);
    expect(after?.[0]?.value).toBe(1);
    expect(after?.at(-1)?.value).toBe(9999);
  });

  it("__reset でバケットが空になる", () => {
    recordVitalsSample("LCP", "/", 100);
    expect(__getVitalsBucketsForTesting().size).toBe(1);
    __resetVitalsStoreForTesting();
    expect(__getVitalsBucketsForTesting().size).toBe(0);
  });

  it("getAllVitalsSummary は store に投入したサンプルから summary を返す", () => {
    recordVitalsSample("LCP", "/", 1000, 1);
    recordVitalsSample("LCP", "/", 2000, 2);
    recordVitalsSample("LCP", "/", 3000, 3);
    recordVitalsSample("INP", "/", 50, 4);

    const summaries = getAllVitalsSummary();
    expect(summaries).toHaveLength(2);
    const lcp = summaries.find((s) => s.metric === "LCP");
    expect(lcp).toMatchObject({
      metric: "LCP",
      path: "/",
      sampleCount: 3,
      median: 2000,
    });
    const inp = summaries.find((s) => s.metric === "INP");
    expect(inp?.sampleCount).toBe(1);
    expect(inp?.median).toBe(50);
  });

  it("空 store のときは空配列を返す", () => {
    expect(getAllVitalsSummary()).toEqual([]);
  });
});
