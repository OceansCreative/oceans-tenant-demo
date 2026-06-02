/**
 * @file extract_property の出力品質を測るメトリクス群。
 *
 * 全関数は副作用なしの純粋関数で、`__tests__/metrics.test.mjs` から
 * `node --test` で直接呼び出してユニットテストする。
 *
 * 設計指針:
 * - 数値フィールド（rent / area / floor）: 完全一致 or 許容範囲内なら 1.0、外なら 0.0
 * - 配列フィールド（nearestStations / suitableBusinessRefs / features）: Jaccard 類似度
 * - テキストフィールド（title / description）: 正規化後の Sørensen–Dice 係数
 * - enum / boolean: 厳密一致
 * - 全体スコア: 各フィールドスコアの重み付き算術平均
 *
 * precision / recall / F1 は「フィールドが存在し、かつ正解と一致した」ことを true positive
 * として、fixture 横断で集計する。
 */

/**
 * @typedef {Object} FieldScore
 * @property {string} field 対象フィールド名（例: "rent"）
 * @property {number} score 0〜1 のスコア
 * @property {boolean} matched 厳密一致したかどうか（precision / recall の集計に使う）
 * @property {boolean} expectedPresent expected 側にフィールドが存在するか
 * @property {boolean} actualPresent actual 側にフィールドが存在するか
 * @property {unknown} expected 期待値（diff 表示用）
 * @property {unknown} actual 実測値（diff 表示用）
 */

/**
 * @typedef {Object} FixtureResult
 * @property {string} fixtureId
 * @property {FieldScore[]} fields
 * @property {number} overallScore 全体スコア（フィールド別重み付き平均）
 */

/**
 * @typedef {Object} AggregateMetrics
 * @property {number} precision
 * @property {number} recall
 * @property {number} f1
 * @property {number} overallScore 全 fixture の overallScore 平均
 * @property {Record<string, { score: number; matched: number; total: number }>} perField
 */

/**
 * フィールドごとの重み。全体スコアの加重平均に使う。
 * 抽出失敗のインパクトが大きいフィールドほど重く設定。
 *
 * 合計値は正規化のため任意（内部で sum で割る）。
 */
export const FIELD_WEIGHTS = Object.freeze({
  title: 1.0,
  "address.prefecture": 1.5,
  "address.city": 1.5,
  rent: 2.0,
  area: 2.0,
  buildingType: 1.0,
  condition: 1.0,
  nearestStations: 1.5,
  suitableBusinessRefs: 1.0,
  features: 0.5,
  description: 0.5,
  floor: 0.5,
});

/**
 * 数値の許容範囲（±）。指定がなければ完全一致が必要。
 */
export const NUMERIC_TOLERANCE = Object.freeze({
  rent: 0, // 賃料は完全一致を期待
  area: 1, // ㎡ は ±1 を許容（小数点表記のゆれ）
});

/**
 * @param {string} s
 * @returns {string}
 */
const normalizeText = (s) =>
  s
    .toLowerCase()
    .replace(/[\s　]+/g, " ")
    .replace(/[、。,.\-_/()\[\]「」『』]/g, "")
    .trim();

/**
 * Sørensen–Dice 係数（バイグラム）でテキスト類似度を測る。
 * 完全一致: 1.0、無関係: 0.0。
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export const textSimilarity = (a, b) => {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na.length === 0 && nb.length === 0) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) {
    return na === nb ? 1 : 0;
  }
  /** @param {string} s */
  const bigrams = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i += 1) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let inter = 0;
  for (const [g, count] of ba.entries()) {
    const other = bb.get(g);
    if (other !== undefined) inter += Math.min(count, other);
  }
  /** @param {Map<string, number>} m */
  const total = (m) => {
    let n = 0;
    for (const v of m.values()) n += v;
    return n;
  };
  return (2 * inter) / (total(ba) + total(bb));
};

/**
 * @param {ReadonlyArray<unknown>} a
 * @param {ReadonlyArray<unknown>} b
 * @returns {number}
 */
export const jaccardSimilarity = (a, b) => {
  const sa = new Set(a.map((v) => JSON.stringify(v)));
  const sb = new Set(b.map((v) => JSON.stringify(v)));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const v of sa) if (sb.has(v)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 1 : inter / union;
};

/**
 * 駅オブジェクトを駅名+路線のキーに正規化してから Jaccard を取る。
 * walkMinutes の小さなぶれは類似度に影響させない。
 *
 * @param {ReadonlyArray<{line:string; station:string; walkMinutes:number}>} a
 * @param {ReadonlyArray<{line:string; station:string; walkMinutes:number}>} b
 * @returns {number}
 */
export const nearestStationsSimilarity = (a, b) => {
  /** @param {{line:string; station:string}} s */
  const key = (s) => `${normalizeText(s.line)}::${normalizeText(s.station)}`;
  return jaccardSimilarity(a.map(key), b.map(key));
};

/**
 * 数値が許容範囲内に収まっているかを判定。
 *
 * @param {number} expected
 * @param {number} actual
 * @param {number} tolerance
 * @returns {boolean}
 */
export const numericWithinTolerance = (expected, actual, tolerance) =>
  Math.abs(expected - actual) <= tolerance;

/**
 * dot 区切りのパスで object をたどる。存在しなければ undefined。
 *
 * @param {Record<string, unknown> | undefined | null} obj
 * @param {string} path
 * @returns {unknown}
 */
const getByPath = (obj, path) => {
  if (obj === undefined || obj === null) return undefined;
  /** @type {unknown} */
  let cur = obj;
  for (const seg of path.split(".")) {
    if (cur === undefined || cur === null) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = /** @type {Record<string, unknown>} */ (cur)[seg];
  }
  return cur;
};

/**
 * 1 つの fixture について expected と actual を比較する。
 *
 * @param {string} fixtureId
 * @param {Record<string, unknown>} expected
 * @param {Record<string, unknown> | null} actual `null` は抽出全失敗を表す
 * @returns {FixtureResult}
 */
export const scoreFixture = (fixtureId, expected, actual) => {
  /** @type {FieldScore[]} */
  const fields = [];

  /** @param {string} path */
  const compareScalar = (path) => {
    const exp = getByPath(expected, path);
    const act = actual ? getByPath(actual, path) : undefined;
    const expectedPresent = exp !== undefined;
    const actualPresent = act !== undefined;
    let score = 0;
    let matched = false;
    if (!expectedPresent && !actualPresent) {
      score = 1;
      matched = true;
    } else if (expectedPresent && actualPresent) {
      if (typeof exp === "number" && typeof act === "number") {
        const tol = NUMERIC_TOLERANCE[/** @type {keyof typeof NUMERIC_TOLERANCE} */ (path)] ?? 0;
        matched = numericWithinTolerance(exp, act, tol);
        score = matched ? 1 : 0;
      } else if (typeof exp === "string" && typeof act === "string") {
        if (path === "title" || path === "description") {
          score = textSimilarity(exp, act);
          matched = score >= 0.8;
        } else {
          matched = exp === act;
          score = matched ? 1 : 0;
        }
      } else if (typeof exp === "boolean" && typeof act === "boolean") {
        matched = exp === act;
        score = matched ? 1 : 0;
      } else {
        matched = JSON.stringify(exp) === JSON.stringify(act);
        score = matched ? 1 : 0;
      }
    }
    fields.push({ field: path, score, matched, expectedPresent, actualPresent, expected: exp, actual: act });
  };

  /**
   * @param {string} path
   * @param {(a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>) => number} sim
   */
  const compareArray = (path, sim) => {
    const exp = getByPath(expected, path);
    const act = actual ? getByPath(actual, path) : undefined;
    const expArr = Array.isArray(exp) ? exp : [];
    const actArr = Array.isArray(act) ? act : [];
    const expectedPresent = expArr.length > 0;
    const actualPresent = actArr.length > 0;
    const score = sim(expArr, actArr);
    const matched = score >= 0.8;
    fields.push({ field: path, score, matched, expectedPresent, actualPresent, expected: expArr, actual: actArr });
  };

  compareScalar("title");
  compareScalar("address.prefecture");
  compareScalar("address.city");
  compareScalar("rent");
  compareScalar("area");
  compareScalar("buildingType");
  compareScalar("condition");
  compareScalar("floor");
  compareScalar("description");
  compareArray("nearestStations", (a, b) =>
    nearestStationsSimilarity(
      /** @type {ReadonlyArray<{line:string;station:string;walkMinutes:number}>} */ (a),
      /** @type {ReadonlyArray<{line:string;station:string;walkMinutes:number}>} */ (b),
    ),
  );
  compareArray("suitableBusinessRefs", jaccardSimilarity);
  compareArray("features", jaccardSimilarity);

  let weighted = 0;
  let totalWeight = 0;
  for (const f of fields) {
    const w = FIELD_WEIGHTS[/** @type {keyof typeof FIELD_WEIGHTS} */ (f.field)] ?? 0.5;
    weighted += w * f.score;
    totalWeight += w;
  }
  const overallScore = totalWeight === 0 ? 0 : weighted / totalWeight;
  return { fixtureId, fields, overallScore };
};

/**
 * 複数 fixture から precision / recall / F1 と全体スコアを集計する。
 *
 * - precision = matched / actualPresent
 * - recall    = matched / expectedPresent
 * - F1        = 2PR / (P+R)
 *
 * @param {ReadonlyArray<FixtureResult>} results
 * @returns {AggregateMetrics}
 */
export const aggregateMetrics = (results) => {
  let truePositives = 0;
  let actualPresentTotal = 0;
  let expectedPresentTotal = 0;
  let overallSum = 0;
  /** @type {Record<string, { score: number; matched: number; total: number }>} */
  const perField = {};

  for (const r of results) {
    overallSum += r.overallScore;
    for (const f of r.fields) {
      if (f.expectedPresent) expectedPresentTotal += 1;
      if (f.actualPresent) actualPresentTotal += 1;
      if (f.matched && f.expectedPresent && f.actualPresent) truePositives += 1;
      const slot = perField[f.field] ?? { score: 0, matched: 0, total: 0 };
      slot.score += f.score;
      slot.matched += f.matched ? 1 : 0;
      slot.total += 1;
      perField[f.field] = slot;
    }
  }

  const precision = actualPresentTotal === 0 ? 0 : truePositives / actualPresentTotal;
  const recall = expectedPresentTotal === 0 ? 0 : truePositives / expectedPresentTotal;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const overallScore = results.length === 0 ? 0 : overallSum / results.length;
  return { precision, recall, f1, overallScore, perField };
};
