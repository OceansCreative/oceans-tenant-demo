/**
 * Web Vitals 計測のドメイン型定義。
 *
 * `web-vitals` v5 が提供する 5 メトリクスを「我々が計測対象とする集合」として
 * 明示的に narrow しておく。`zod` スキーマ（route.ts 側）と型を一致させるための
 * 単一の Source of Truth を、ライブラリ層 (`lib/vitals/`) に置く。
 */

/**
 * 計測対象メトリクス。`web-vitals` の `onLCP` / `onINP` / `onCLS` / `onFCP` / `onTTFB`
 * に対応する name 文字列と一致させる。
 *
 * - LCP: Largest Contentful Paint（ms）
 * - INP: Interaction to Next Paint（ms）
 * - CLS: Cumulative Layout Shift（無次元、0–無限）
 * - FCP: First Contentful Paint（ms）
 * - TTFB: Time to First Byte（ms）
 */
export const VITALS_METRIC_VALUES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;

export type VitalsMetric = (typeof VITALS_METRIC_VALUES)[number];

/**
 * `navigator.sendBeacon` 送信用のペイロード型。
 *
 * - `path`: pathname のみ（query string / hash 含めない。個人情報除外戦略）
 * - `navigationType`: `web-vitals` の `Metric.navigationType` をそのまま転送
 */
export type VitalsBeaconPayload = {
  readonly metric: VitalsMetric;
  readonly value: number;
  readonly path: string;
  readonly navigationType: "navigate" | "reload" | "back_forward" | "prerender" | "restore";
};

/**
 * Google 公式の Core Web Vitals 閾値（2024 年版）。
 *
 * - LCP: ≤ 2500ms = good、≤ 4000ms = needs improvement、> 4000ms = poor
 * - INP: ≤ 200ms = good、≤ 500ms = needs improvement、> 500ms = poor
 * - CLS: ≤ 0.1 = good、≤ 0.25 = needs improvement、> 0.25 = poor
 * - FCP: ≤ 1800ms = good、≤ 3000ms = needs improvement、> 3000ms = poor
 * - TTFB: ≤ 800ms = good、≤ 1800ms = needs improvement、> 1800ms = poor
 *
 * 参考: https://web.dev/articles/vitals
 *
 * `good` と `needsImprovement` の上限値を保持する。`poor` はそれ超え。
 */
export type VitalsThreshold = {
  readonly good: number;
  readonly needsImprovement: number;
};

export const VITALS_THRESHOLDS: Readonly<Record<VitalsMetric, VitalsThreshold>> = {
  LCP: { good: 2500, needsImprovement: 4000 },
  INP: { good: 200, needsImprovement: 500 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

export type VitalsRating = "good" | "needsImprovement" | "poor";

/**
 * 値 → rating を計算する pure 関数。閾値は `VITALS_THRESHOLDS` を参照。
 *
 * 「= 閾値ちょうど」のケースは Google の定義に合わせ `<=` 側に倒す（good 寄り）。
 */
export const rateVitalsValue = (metric: VitalsMetric, value: number): VitalsRating => {
  const threshold = VITALS_THRESHOLDS[metric];
  if (value <= threshold.good) return "good";
  if (value <= threshold.needsImprovement) return "needsImprovement";
  return "poor";
};
