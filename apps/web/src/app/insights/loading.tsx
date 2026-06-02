/**
 * /insights 専用のローディング UI（App Router の `loading.tsx`）。
 *
 * recharts は CSR でしか描画されないため、SSR 段階で空白にならないよう
 * KPI カード 4 枚 + chart 4 枠の skeleton を返してレイアウトシフトを抑える。
 * 寸法 (h-24 / h-72) は本番 UI と完全一致させて CLS を 0 に近づける。
 */
const InsightsLoading = (): React.JSX.Element => {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="container-page py-10"
      data-testid="insights-loading"
    >
      <div className="mb-8 space-y-3">
        <div className="h-3 w-40 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-neutral-200 sm:w-1/2" />
        <div className="h-4 w-3/4 animate-pulse rounded-md bg-neutral-100" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton 用途で安定 index で問題ない。
            key={`kpi-skeleton-${index}`}
            className="h-24 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100"
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton 用途で安定 index で問題ない。
            key={`chart-skeleton-${index}`}
            className="h-96 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100"
          />
        ))}
      </div>
      <p className="sr-only">読み込み中です…</p>
    </div>
  );
};

export default InsightsLoading;
