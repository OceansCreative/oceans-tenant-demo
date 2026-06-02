import { useTranslations } from "next-intl";
import { formatJpyCompact, formatSquareMeter } from "@/lib/format";
import type { KpiSummary } from "@/lib/insights/aggregate";

type KpiCardsProps = {
  readonly kpis: KpiSummary;
};

/**
 * /insights 上部の KPI カード 4 枚。
 *
 * - i18n は `insights.kpi.*` 名前空間
 * - 賃料は compact 表記（例: ¥44.6 万）で省スペースに
 * - 物件件数 0 のときも 0 と表示する（プレースホルダ非表示の方が読みやすい）
 * - Server Component から `useTranslations()` 呼び出し可能（next-intl 4）
 */
export const KpiCards = ({ kpis }: KpiCardsProps): React.JSX.Element => {
  const t = useTranslations("insights.kpi");
  const items: ReadonlyArray<{ label: string; value: string }> = [
    { label: t("total"), value: `${kpis.total} ${t("totalUnit")}` },
    { label: t("avgRent"), value: formatJpyCompact(kpis.avgRent) },
    { label: t("avgArea"), value: formatSquareMeter(kpis.avgArea) },
    { label: t("publishing"), value: `${kpis.publishingCount} ${t("totalUnit")}` },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <dt className="text-xs font-medium text-neutral-500">{item.label}</dt>
          <dd className="mt-2 text-xl font-bold text-neutral-900 sm:text-2xl">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};
