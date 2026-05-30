import type { Metadata } from "next";
import { PropertyMap } from "@/components/map/PropertyMap";
import { PropertyCard } from "@/components/property/PropertyCard";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchFilter } from "@/components/search/SearchFilter";
import { type ViewMode, ViewModeToggle } from "@/components/search/ViewModeToggle";
import { filterProperties } from "@/lib/filter-properties";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { EMPTY_CRITERIA, parseSearchCriteria } from "@/lib/search-criteria";

export const metadata: Metadata = {
  title: "物件を探す",
  description: "店舗物件を地図またはカード一覧で検索します。",
};

type SearchPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const toUrlSearchParams = (raw: Record<string, string | string[] | undefined>): URLSearchParams => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.append(key, value);
    }
  }
  return params;
};

const SearchPage = async ({ searchParams }: SearchPageProps): Promise<React.JSX.Element> => {
  const raw = await searchParams;
  const urlParams = toUrlSearchParams(raw);
  const criteria = parseSearchCriteria(urlParams);
  const viewModeRaw = urlParams.get("view");
  const viewMode: ViewMode = viewModeRaw === "map" ? "map" : "list";
  const results = filterProperties(MOCK_PROPERTIES, criteria);
  const isFiltered = JSON.stringify(criteria) !== JSON.stringify(EMPTY_CRITERIA);

  return (
    <div className="container-page py-10">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">物件を探す</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {results.length} 件 / 全 {MOCK_PROPERTIES.length} 件{isFiltered && "（フィルタ適用中）"}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar className="sm:w-96" />
          <ViewModeToggle current={viewMode} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <SearchFilter className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto" />

        <section aria-label="検索結果">
          {viewMode === "map" ? (
            <PropertyMap properties={results} className="min-h-[600px]" />
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center">
              <p className="text-sm font-semibold text-neutral-700">
                該当する物件が見つかりませんでした
              </p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                フィルタ条件を緩めるか、自然言語検索で「新宿で 30
                坪、カフェ向け」のように指定してみてください。
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((property) => (
                <li key={property.slug}>
                  <PropertyCard property={property} className="h-full" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default SearchPage;
