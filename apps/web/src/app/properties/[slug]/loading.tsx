/**
 * 物件詳細用 loading UI。`generateStaticParams` で SSG 済みのため通常は即返却だが、
 * fallback 経路（ISR の revalidate）でも即時 skeleton を表示できるよう用意する。
 */
const PropertyDetailLoading = (): React.JSX.Element => {
  return (
    <div aria-busy="true" aria-live="polite" className="container-page py-10">
      <div className="mb-6 h-3 w-40 animate-pulse rounded-full bg-neutral-100" />
      <div className="mb-8 h-9 w-2/3 animate-pulse rounded-md bg-neutral-200" />
      <div className="aspect-video w-full animate-pulse rounded-2xl bg-neutral-100" />
      <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-neutral-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />
      </div>
      <p className="sr-only">物件詳細を読み込み中です…</p>
    </div>
  );
};

export default PropertyDetailLoading;
