import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChartsGrid } from "@/components/insights/ChartsGrid";
import { KpiCards } from "@/components/insights/KpiCards";
import {
  aggregateByCondition,
  aggregateByPrefecture,
  aggregatePropertiesByBuildingType,
  computeKpis,
  histogramRent,
} from "@/lib/insights/aggregate";
import { fetchProperties } from "@/lib/properties";
import { EMPTY_CRITERIA } from "@/lib/search-criteria";

export const metadata: Metadata = {
  title: "物件データ可視化",
  description:
    "業態 / 都道府県 / 賃料 / 物件状態の 4 軸で店舗物件 mock データを可視化する OSS リファレンス実装のサンプル。",
  alternates: { canonical: "/insights" },
  openGraph: {
    type: "website",
    url: "/insights",
    title: "物件データ可視化",
    description:
      "業態 / 都道府県 / 賃料 / 物件状態の 4 軸で店舗物件 mock データを可視化するサンプル。",
  },
  twitter: {
    card: "summary",
    title: "物件データ可視化",
    description:
      "業態 / 都道府県 / 賃料 / 物件状態の 4 軸で店舗物件 mock データを可視化するサンプル。",
  },
};

/**
 * /insights — 物件統計ダッシュボードページ（Server Component）。
 *
 * - データ取得: `fetchProperties()`（mock / Sanity を env 切替）
 *   全件取得したいので pageSize を十分大きく取り、page=1 で固定する。
 * - 集計: `lib/insights/aggregate.ts` の pure 関数群
 * - 各 chart は Client Component（recharts は CSR）として描画
 * - i18n: `useTranslations` ではなく Server 側の `getTranslations` を使用
 */
const InsightsPage = async (): Promise<React.JSX.Element> => {
  const t = await getTranslations("insights");

  // mock は 5 件しかないが、Sanity 実接続時に十分なサイズを取る前提で大きめの pageSize を渡す。
  // ダッシュボードは page = 1 固定で全件まとめて集計するのが自然。
  const { items } = await fetchProperties({ ...EMPTY_CRITERIA, page: 1, pageSize: 200 });

  const kpis = computeKpis(items);
  const buildingTypeBuckets = aggregatePropertiesByBuildingType(items);
  const prefectureBuckets = aggregateByPrefecture(items);
  const rentBins = histogramRent(items);
  const conditionBuckets = aggregateByCondition(items);

  return (
    <main className="container-page py-10">
      <header className="mb-8 flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-600">
          {t("dataSource")}
        </p>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("title")}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-neutral-600">{t("lead")}</p>
      </header>

      <section aria-label={t("title")} className="flex flex-col gap-6">
        <KpiCards kpis={kpis} />

        <ChartsGrid
          buildingTypeBuckets={buildingTypeBuckets}
          prefectureBuckets={prefectureBuckets}
          rentBins={rentBins}
          conditionBuckets={conditionBuckets}
        />
      </section>
    </main>
  );
};

export default InsightsPage;
