/**
 * `/search` 用 loading UI。Server Component で URL パース / filter を実行している間、
 * カードグリッドの骨格だけを即返して FCP / LCP を確保する。
 */
const SearchLoading = (): React.JSX.Element => {
  return (
    <div aria-busy="true" aria-live="polite" className="container-page py-10">
      <header className="mb-6 space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-4 w-56 animate-pulse rounded-md bg-neutral-100" />
      </header>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="hidden h-[480px] animate-pulse rounded-2xl bg-neutral-100 lg:block" />
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <li
              // 静的な skeleton は順序固定の index key で十分（要素間の差別化情報がないため）。
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton 用途で安定 index で問題ない。
              key={`search-skeleton-${index}`}
              className="h-72 animate-pulse rounded-2xl bg-neutral-100"
            />
          ))}
        </ul>
      </div>
      <p className="sr-only">検索結果を読み込み中です…</p>
    </div>
  );
};

export default SearchLoading;
