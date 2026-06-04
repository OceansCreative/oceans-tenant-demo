/**
 * Web Vitals サンプルの集計用 pure 関数群。
 *
 * v0.10.0 / WS-2 — `web-vitals` で計測したフィールドデータ（LCP / INP / CLS / FCP / TTFB）
 * の中央値 / p75 / サンプル数を返す。テスト容易性を最優先にするため、
 * 副作用ゼロ・引数 → 戻り値だけで完結する関数として切り出している。
 *
 * 設計上の前提:
 * - 入力は `Sample[]`（`{ value, timestamp }`）のみ。timestamp は集計順や
 *   時系列フィルタには現状使わないが、将来の「直近 N 分のみで集計」拡張を
 *   見越して型に保持しておく。
 * - 統計関数（median / p75）は **線形補間** ではなく **隣接サンプルの平均** を
 *   採用する（簡素で説明容易）。p75 の計算アルゴリズムは複数あるが、フィールド
 *   実測のラフな目安としてはこれで十分。本格的な分析は ClickHouse / BigQuery 等
 *   に流して quantile 関数を使う前提。
 * - 空配列は `null` を返す（呼び出し側で「サンプル不足」を表示する）。
 */

import { VITALS_METRIC_VALUES, type VitalsMetric } from "./types";

export type Sample = {
  readonly value: number;
  readonly timestamp: number;
};

export type MetricSummary = {
  readonly metric: VitalsMetric;
  readonly path: string;
  readonly sampleCount: number;
  readonly median: number;
  readonly p75: number;
};

/**
 * 配列を昇順にソートしたコピーを返す（入力は不変）。
 */
const sortedAscending = (values: ReadonlyArray<number>): number[] =>
  [...values].sort((a, b) => a - b);

/**
 * 中央値。要素数が偶数なら中央 2 要素の平均、奇数ならど真ん中の要素を返す。
 * 空配列は呼び出し側で除外している前提。
 */
export const median = (values: ReadonlyArray<number>): number => {
  if (values.length === 0) return 0;
  const sorted = sortedAscending(values);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    // 奇数: ど真ん中
    return sorted[mid] ?? 0;
  }
  // 偶数: 中央 2 要素の平均
  const left = sorted[mid - 1] ?? 0;
  const right = sorted[mid] ?? 0;
  return (left + right) / 2;
};

/**
 * p75（75 パーセンタイル）。
 *
 * - サンプル数が 1 件のときはその値をそのまま返す
 * - 「上から数えて全体の 75% 番目」のインデックスを `ceil(n * 0.75) - 1` で取る
 *   （nearest-rank 法）。線形補間より直感的で、Web Vitals の Google 公式
 *   推奨値の説明とも揃う。
 */
export const p75 = (values: ReadonlyArray<number>): number => {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0] ?? 0;
  const sorted = sortedAscending(values);
  const rank = Math.ceil(sorted.length * 0.75);
  // 1-indexed の rank を 0-indexed に
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? 0;
};

/**
 * 単一 (metric, path) のサンプル群を `MetricSummary` に集計する。
 * 空配列のときは null を返す。
 */
export const summarizeSamples = (
  metric: VitalsMetric,
  path: string,
  samples: ReadonlyArray<Sample>,
): MetricSummary | null => {
  if (samples.length === 0) return null;
  const values = samples.map((sample) => sample.value);
  return {
    metric,
    path,
    sampleCount: samples.length,
    median: median(values),
    p75: p75(values),
  };
};

/**
 * store からまとめて取り出した `Map<key, Sample[]>` を、UI で使う配列形に変換する。
 *
 * - key 形式は `${metric}:${path}` を前提（store と同じ）
 * - メトリクス未登録 / path 不明など壊れたキーは無視する
 * - 戻り順は metric 順（VITALS_METRIC_VALUES の宣言順）→ path 昇順で安定化させる
 */
export const summarizeAllSamples = (
  buckets: ReadonlyMap<string, ReadonlyArray<Sample>>,
): ReadonlyArray<MetricSummary> => {
  const summaries: MetricSummary[] = [];
  for (const [key, samples] of buckets.entries()) {
    const parsed = parseBucketKey(key);
    if (!parsed) continue;
    const summary = summarizeSamples(parsed.metric, parsed.path, samples);
    if (summary) summaries.push(summary);
  }
  const metricOrder = new Map<VitalsMetric, number>(
    VITALS_METRIC_VALUES.map((metric, index) => [metric, index]),
  );
  return summaries.sort((a, b) => {
    const aOrder = metricOrder.get(a.metric) ?? Number.POSITIVE_INFINITY;
    const bOrder = metricOrder.get(b.metric) ?? Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.path.localeCompare(b.path);
  });
};

/**
 * `${metric}:${path}` 形式のキーをパースする。
 *
 * path 側にコロンが含まれてもよいよう、最初のコロンだけで分割する。
 * 未知の metric は null を返す（store には入っていない想定だが、防御的に弾く）。
 */
export const parseBucketKey = (key: string): { metric: VitalsMetric; path: string } | null => {
  const colonIndex = key.indexOf(":");
  if (colonIndex <= 0 || colonIndex === key.length - 1) return null;
  const metricCandidate = key.slice(0, colonIndex);
  const path = key.slice(colonIndex + 1);
  if (!VITALS_METRIC_VALUES.includes(metricCandidate as VitalsMetric)) return null;
  return { metric: metricCandidate as VitalsMetric, path };
};

/**
 * `${metric}:${path}` 形式のキーを作る。store と aggregate で共通利用する。
 */
export const buildBucketKey = (metric: VitalsMetric, path: string): string => `${metric}:${path}`;
