/**
 * /insights ページ下部の Web Vitals サマリ表。
 *
 * 設計判断:
 * - Server Component（Hooks 経由で `useTranslations` を使うが、データ取得は親
 *   `/insights/page.tsx` 側で行い props で受ける）
 * - 値は `MetricSummary[]` を受け取り、メトリクス × path のテーブルを描画する
 * - 色分けは text + アイコン（記号）の両方で識別可能にする（色覚多様性対応）
 * - 空状態は `vitals.empty` の文を表示
 *
 * a11y:
 * - `<section aria-labelledby>` で landmark を分離
 * - `<table>` には `<caption>` を sr-only で付与し、列ヘッダは `<th scope="col">`
 * - 行の rating は `aria-label` で「LCP は良好の範囲です」のように読み上げる
 */

import { useTranslations } from "next-intl";
import type { MetricSummary } from "@/lib/vitals/aggregate";
import { rateVitalsValue, type VitalsMetric, type VitalsRating } from "@/lib/vitals/types";

type VitalsPanelProps = {
  readonly summaries: ReadonlyArray<MetricSummary>;
};

/**
 * メトリクスごとの単位ラベル。CLS は無次元のため `（無次元）`、その他は ms。
 */
const unitLabelFor = (metric: VitalsMetric, t: (key: "ms" | "score") => string): string => {
  return metric === "CLS" ? t("score") : t("ms");
};

/**
 * rating ごとの視覚 / 文字スタイル + 記号。色だけに依存しないよう記号を必ず併用する。
 *
 * - good: 緑 + ●
 * - needsImprovement: 琥珀色 + ◐
 * - poor: 赤 + ◯（中抜きで「要改善」を直感的に示す）
 */
const ratingStyles: Readonly<Record<VitalsRating, { className: string; symbol: string }>> = {
  good: {
    className: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    symbol: "●",
  },
  needsImprovement: {
    className: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
    symbol: "◐",
  },
  poor: {
    className: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
    symbol: "◯",
  },
};

/**
 * 数値を見やすく整形する。
 *
 * - 時間系（ms）: 1 桁の小数 + " ms"
 * - CLS: 小数 3 桁（0.123 のような表記が業界標準）
 */
const formatValue = (metric: VitalsMetric, value: number, unitLabel: string): string => {
  if (metric === "CLS") {
    return value.toFixed(3);
  }
  // 1000 ms 以上は秒換算を併記してもよいが、Web Vitals ダッシュボードは ms 一本が主流。
  return `${Math.round(value)} ${unitLabel}`;
};

const metricToI18nKey = (metric: VitalsMetric): "lcp" | "inp" | "cls" | "fcp" | "ttfb" => {
  switch (metric) {
    case "LCP":
      return "lcp";
    case "INP":
      return "inp";
    case "CLS":
      return "cls";
    case "FCP":
      return "fcp";
    case "TTFB":
      return "ttfb";
  }
};

export const VitalsPanel = ({ summaries }: VitalsPanelProps): React.JSX.Element => {
  const t = useTranslations("vitals");
  const tMetric = useTranslations("vitals.metric");
  const tMetricFullName = useTranslations("vitals.metricFullName");
  const tThreshold = useTranslations("vitals.threshold");
  const tThresholdSr = useTranslations("vitals.thresholdSr");
  const tUnit = useTranslations("vitals.unit");

  const headingId = "vitals-section-title";
  const captionId = "vitals-section-caption";

  if (summaries.length === 0) {
    return (
      <section
        aria-labelledby={headingId}
        className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <h2 id={headingId} className="text-base font-semibold text-neutral-900">
          {t("title")}
        </h2>
        <p id={captionId} className="text-sm leading-relaxed text-neutral-600">
          {t("lead")}
        </p>
        <p
          className="rounded-xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500"
          data-testid="vitals-empty"
        >
          {t("empty")}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={captionId}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
    >
      <h2 id={headingId} className="text-base font-semibold text-neutral-900">
        {t("title")}
      </h2>
      <p id={captionId} className="text-sm leading-relaxed text-neutral-600">
        {t("lead")}
      </p>
      {/* axe `scrollable-region-focusable`: 横スクロール領域はキーボード focus 可能にする。
          親 <section> が既に region なので role/aria-labelledby は付けず tabIndex のみ付与。 */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: スクロール領域へのキーボード到達のため意図的に付与（axe scrollable-region-focusable 対応） */}
      <div className="overflow-x-auto" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t("tableLabel")}</caption>
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t("columnMetric")}
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                {t("columnPath")}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                {t("columnMedian")}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                {t("columnP75")}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                {t("columnSampleCount")}
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                {t("columnRating")}
              </th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((row) => {
              const metricKey = metricToI18nKey(row.metric);
              const metricShortLabel = tMetric(metricKey);
              const metricFullName = tMetricFullName(metricKey);
              const unitLabel = unitLabelFor(row.metric, tUnit);
              const rating = rateVitalsValue(row.metric, row.p75);
              const style = ratingStyles[rating];
              return (
                <tr
                  key={`${row.metric}:${row.path}`}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  <th scope="row" className="py-2 pr-3 font-medium text-neutral-900">
                    <span aria-hidden="true">{metricShortLabel}</span>
                    <span className="sr-only">{metricFullName}</span>
                  </th>
                  <td className="py-2 pr-3 font-mono text-xs text-neutral-700">{row.path}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-800">
                    {formatValue(row.metric, row.median, unitLabel)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-800">
                    {formatValue(row.metric, row.p75, unitLabel)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-800">
                    {row.sampleCount}
                  </td>
                  <td className="py-2 pr-3">
                    {/* `role="img"` で `aria-label` を読み上げる。視覚は色＋記号＋テキストの 3 重で識別可能。 */}
                    <span
                      role="img"
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
                      aria-label={tThresholdSr(rating, { metric: metricFullName })}
                    >
                      <span aria-hidden="true">{style.symbol}</span>
                      <span aria-hidden="true">{tThreshold(rating)}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
