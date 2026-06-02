/**
 * @file metrics.mjs のユニットテスト。
 *
 * `node --test` ランナーで動くため、外部依存ゼロで実行可能。
 * `pnpm --filter oceans-tenant-eval test` から起動される。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateMetrics,
  jaccardSimilarity,
  nearestStationsSimilarity,
  numericWithinTolerance,
  scoreFixture,
  textSimilarity,
} from "../metrics.mjs";

describe("textSimilarity", () => {
  it("完全一致なら 1 を返す", () => {
    assert.equal(textSimilarity("カフェ向け路面店", "カフェ向け路面店"), 1);
  });

  it("空文字同士は 1 を返す", () => {
    assert.equal(textSimilarity("", ""), 1);
  });

  it("片方が空なら 0", () => {
    assert.equal(textSimilarity("カフェ", ""), 0);
  });

  it("ノイズや句読点違いに頑健（>=0.7）", () => {
    const score = textSimilarity(
      "渋谷区道玄坂のカフェ向け路面店",
      "渋谷区道玄坂の、カフェ向け路面店！",
    );
    assert.ok(score >= 0.7, `期待 0.7 以上、実測 ${score}`);
  });

  it("無関係なテキストは低スコア（<0.3）", () => {
    const score = textSimilarity("カフェ向け路面店", "オフィスビル区画");
    assert.ok(score < 0.3, `期待 0.3 未満、実測 ${score}`);
  });
});

describe("jaccardSimilarity", () => {
  it("完全一致なら 1", () => {
    assert.equal(jaccardSimilarity(["a", "b", "c"], ["c", "b", "a"]), 1);
  });

  it("無共通要素なら 0", () => {
    assert.equal(jaccardSimilarity(["a"], ["b"]), 0);
  });

  it("部分一致は 0〜1 の範囲", () => {
    const s = jaccardSimilarity(["a", "b"], ["b", "c"]);
    assert.equal(s, 1 / 3);
  });

  it("両方空なら 1（共に「無」で一致）", () => {
    assert.equal(jaccardSimilarity([], []), 1);
  });
});

describe("nearestStationsSimilarity", () => {
  it("walkMinutes のずれは無視され、路線+駅で比較する", () => {
    const a = [{ line: "JR 山手線", station: "渋谷", walkMinutes: 3 }];
    const b = [{ line: "JR 山手線", station: "渋谷", walkMinutes: 5 }];
    assert.equal(nearestStationsSimilarity(a, b), 1);
  });

  it("駅が違えば 0", () => {
    const a = [{ line: "JR 山手線", station: "渋谷", walkMinutes: 3 }];
    const b = [{ line: "JR 山手線", station: "新宿", walkMinutes: 3 }];
    assert.equal(nearestStationsSimilarity(a, b), 0);
  });
});

describe("numericWithinTolerance", () => {
  it("差が許容内なら true", () => {
    assert.equal(numericWithinTolerance(100, 101, 1), true);
  });
  it("差が許容外なら false", () => {
    assert.equal(numericWithinTolerance(100, 102, 1), false);
  });
});

describe("scoreFixture", () => {
  const expected = {
    title: "渋谷区道玄坂のカフェ向け路面店",
    address: { prefecture: "東京都", city: "渋谷区" },
    rent: 480000,
    area: 32.5,
    buildingType: "street_level",
    condition: "skeleton",
    nearestStations: [{ line: "JR 山手線", station: "渋谷", walkMinutes: 5 }],
    suitableBusinessRefs: ["category-cafe", "category-bakery"],
    features: ["スケルトン", "視認性高"],
    description: "明治通り沿いの路面店。",
  };

  it("expected と actual が同一なら overallScore は 1", () => {
    const r = scoreFixture("identical", expected, expected);
    assert.equal(r.overallScore, 1);
    for (const f of r.fields) assert.equal(f.score, 1);
  });

  it("actual が null（抽出失敗）なら overallScore は十分に低い（<0.05）", () => {
    // expected 側で値が無いフィールド（floor 等）は「両方なし=1」が成立するため
    // 完全 0 にはならない。重要フィールドはすべて 0 になることを別途検証する。
    const r = scoreFixture("failed", expected, null);
    assert.ok(r.overallScore < 0.05, `overallScore=${r.overallScore}`);
    for (const f of r.fields.filter((x) => x.expectedPresent)) {
      assert.equal(f.score, 0, `${f.field} の score が 0 ではない: ${f.score}`);
    }
  });

  it("rent が完全一致を要求し、ずれていれば 0", () => {
    const altered = { ...expected, rent: 500000 };
    const r = scoreFixture("rent-off", expected, altered);
    const rentField = r.fields.find((f) => f.field === "rent");
    assert.ok(rentField);
    assert.equal(rentField.score, 0);
    assert.equal(rentField.matched, false);
  });

  it("area は ±1 の許容範囲を持つ", () => {
    const altered = { ...expected, area: 33.4 };
    const r = scoreFixture("area-near", expected, altered);
    const areaField = r.fields.find((f) => f.field === "area");
    assert.ok(areaField);
    assert.equal(areaField.score, 1);
  });

  it("buildingType の enum 違いは 0 スコア", () => {
    const altered = { ...expected, buildingType: "building_inline" };
    const r = scoreFixture("type-off", expected, altered);
    const f = r.fields.find((x) => x.field === "buildingType");
    assert.ok(f);
    assert.equal(f.score, 0);
  });
});

describe("aggregateMetrics", () => {
  const expected = {
    title: "A",
    address: { prefecture: "東京都", city: "渋谷区" },
    rent: 100000,
    area: 20,
    buildingType: "street_level",
    condition: "skeleton",
    nearestStations: [{ line: "JR", station: "渋谷", walkMinutes: 3 }],
    suitableBusinessRefs: ["category-cafe"],
    features: ["スケルトン"],
    description: "短い説明",
  };

  it("全 fixture が完全一致なら precision/recall/f1 すべて 1", () => {
    const r1 = scoreFixture("a", expected, expected);
    const r2 = scoreFixture("b", expected, expected);
    const agg = aggregateMetrics([r1, r2]);
    assert.equal(agg.precision, 1);
    assert.equal(agg.recall, 1);
    assert.equal(agg.f1, 1);
    assert.equal(agg.overallScore, 1);
  });

  it("全件抽出失敗（actual=null）なら precision/recall は 0", () => {
    const r = scoreFixture("a", expected, null);
    const agg = aggregateMetrics([r]);
    assert.equal(agg.recall, 0);
    assert.equal(agg.f1, 0);
  });

  it("perField に各フィールドの累計スコアが含まれる", () => {
    const r = scoreFixture("a", expected, expected);
    const agg = aggregateMetrics([r]);
    assert.ok(agg.perField.rent);
    assert.equal(agg.perField.rent.total, 1);
    assert.equal(agg.perField.rent.matched, 1);
  });
});
