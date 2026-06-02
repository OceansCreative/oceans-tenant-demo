"use client";

import dynamic from "next/dynamic";
import type {
  BuildingTypeBucket,
  ConditionBucket,
  PrefectureBucket,
  RentHistogramBin,
} from "@/lib/insights/aggregate";

/**
 * /insights の 4 chart を `next/dynamic` で client-only ロードする薄いラッパ。
 *
 * 目的:
 * - recharts (≈ 100KB gzip) を initial bundle から外し、Lighthouse Performance を維持する。
 * - SSR 段階では同じ枠サイズの skeleton を返して CLS を抑える。
 *
 * 個別の chart コンポーネントはそれぞれ `"use client"` だが、page から直接 import すると
 * 物件統計画面以外でも recharts チャンクが prefetch される可能性があるため、
 * このラッパ経由で `ssr: false` のロード境界を作る。
 */

type ChartsGridProps = {
  readonly buildingTypeBuckets: ReadonlyArray<BuildingTypeBucket>;
  readonly prefectureBuckets: ReadonlyArray<PrefectureBucket>;
  readonly rentBins: ReadonlyArray<RentHistogramBin>;
  readonly conditionBuckets: ReadonlyArray<ConditionBucket>;
};

const Skeleton = (): React.JSX.Element => (
  <div
    aria-hidden="true"
    className="h-96 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100"
  />
);

const BuildingTypeChart = dynamic(
  () => import("./BuildingTypeChart").then((m) => ({ default: m.BuildingTypeChart })),
  { ssr: false, loading: () => <Skeleton /> },
);
const PrefectureBarChart = dynamic(
  () => import("./PrefectureBarChart").then((m) => ({ default: m.PrefectureBarChart })),
  { ssr: false, loading: () => <Skeleton /> },
);
const RentDistribution = dynamic(
  () => import("./RentDistribution").then((m) => ({ default: m.RentDistribution })),
  { ssr: false, loading: () => <Skeleton /> },
);
const ConditionChart = dynamic(
  () => import("./ConditionChart").then((m) => ({ default: m.ConditionChart })),
  { ssr: false, loading: () => <Skeleton /> },
);

export const ChartsGrid = ({
  buildingTypeBuckets,
  prefectureBuckets,
  rentBins,
  conditionBuckets,
}: ChartsGridProps): React.JSX.Element => {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <BuildingTypeChart buckets={buildingTypeBuckets} />
      <PrefectureBarChart buckets={prefectureBuckets} />
      <RentDistribution bins={rentBins} />
      <ConditionChart buckets={conditionBuckets} />
    </div>
  );
};
