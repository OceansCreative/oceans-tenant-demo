import type { Metadata } from "next";
import { PropertyMap } from "@/components/map/PropertyMap";
import { PropertyCard } from "@/components/property/PropertyCard";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchFilter } from "@/components/search/SearchFilter";
import { SearchPagination } from "@/components/search/SearchPagination";
import { type ViewMode, ViewModeToggle } from "@/components/search/ViewModeToggle";
import { filterProperties } from "@/lib/filter-properties";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import {
  EMPTY_CRITERIA,
  parseSearchCriteria,
  serializeSearchCriteria,
} from "@/lib/search-criteria";

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
  const { items, totalCount } = filterProperties(MOCK_PROPERTIES, criteria);
  // 「フィルタ適用中」表記は page / pageSize の差分は含めず判定する。
  const isFiltered =
    JSON.stringify({
      ...criteria,
      page: EMPTY_CRITERIA.page,
      pageSize: EMPTY_CRITERIA.pageSize,
    }) !== JSON.stringify(EMPTY_CRITERIA);
  // 地図モードはページネーション対象外。全件まとめてプロットする方が UX 上自然なため。
  const mapProperties =
    viewMode === "map"
      ? filterProperties(MOCK_PROPERTIES, {
          ...criteria,
          page: 1,
          pageSize: MOCK_PROPERTIES.length || 1,
        }).items
      : items;
  const totalPages = Math.max(1, Math.ceil(totalCount / criteria.pageSize));
  // page が結果の総ページ数を超えた場合（フィルタ後）はクランプ表示する。
  const currentPage = Math.min(criteria.page, totalPages);
  const buildPageHref = (targetPage: number): string => {
    const params = serializeSearchCriteria({ ...criteria, page: targetPage });
    // view パラメータは serializeSearchCriteria の対象外なので個別に引き継ぐ。
    if (viewMode === "map") params.set("view", "map");
    const query = params.toString();
    return query ? `/search?${query}` : "/search";
  };

  return (
    <div className="container-page py-10">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">物件を探す</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {totalCount} 件 / 全 {MOCK_PROPERTIES.length} 件{isFiltered && "（フィルタ適用中）"}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar className="sm:w-96" />
          <ViewModeToggle current={viewMode} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <SearchFilter className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto" />

        <section aria-label="検索結果" className="flex flex-col gap-6">
          {viewMode === "map" ? (
            <PropertyMap properties={mapProperties} className="min-h-[600px]" />
          ) : totalCount === 0 ? (
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
            <>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((property) => (
                  <li key={property.slug}>
                    <PropertyCard property={property} className="h-full" />
                  </li>
                ))}
              </ul>
              <SearchPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={criteria.pageSize}
                buildHref={buildPageHref}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default SearchPage;
