/**
 * ルート共通の loading UI（App Router の `loading.tsx`）。
 *
 * Server Component の fetch / RSC ペイロード生成中に Streaming で即時返却され、
 * Lighthouse の First Contentful Paint / Largest Contentful Paint を底上げする。
 * skeleton はランドマーク領域（header はレイアウト側）を変えないコンテナのみで構成し、
 * Cumulative Layout Shift を増やさない。
 */
const RootLoading = (): React.JSX.Element => {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="container-page py-16 lg:py-24"
      data-testid="root-loading"
    >
      <div className="space-y-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-10 w-3/4 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-10 w-2/3 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-4 w-1/2 animate-pulse rounded-md bg-neutral-100" />
      </div>
      <p className="sr-only">読み込み中です…</p>
    </div>
  );
};

export default RootLoading;
