import Link from "next/link";
import { cn } from "@/lib/cn";

type SearchPaginationProps = {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly totalCount: number;
  readonly pageSize: number;
  /** `targetPage` を引数に取り、その遷移先 URL を返す関数 */
  readonly buildHref: (targetPage: number) => string;
  readonly className?: string;
};

/**
 * 検索結果ページネーション UI。
 *
 * - Server Component として `<Link>` を出力するため、JS なしでもナビゲート可能
 * - 総件数が 0 のときは何も出さない（呼び出し側で 0 件 UI を出す前提）
 * - a11y: `<nav aria-label="ページネーション">` で囲み、現在ページに `aria-current="page"`
 *
 * Phase 3 で GROQ ベースに切り替わっても、`buildHref` を差し替えるだけで再利用できる。
 */

const MAX_VISIBLE_PAGE_NUMBERS = 5;

/**
 * 表示するページ番号のリストを返す（現在ページを中央に最大 5 個）。
 * 例: 総 10 ページ・現在 7 → [5, 6, 7, 8, 9]
 *     総 10 ページ・現在 1 → [1, 2, 3, 4, 5]
 *     総 3 ページ・現在 2 → [1, 2, 3]
 */
const computeVisiblePages = (currentPage: number, totalPages: number): ReadonlyArray<number> => {
  if (totalPages <= MAX_VISIBLE_PAGE_NUMBERS) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const half = Math.floor(MAX_VISIBLE_PAGE_NUMBERS / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + MAX_VISIBLE_PAGE_NUMBERS - 1);
  start = Math.max(1, end - MAX_VISIBLE_PAGE_NUMBERS + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const SearchPagination = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  buildHref,
  className,
}: SearchPaginationProps): React.JSX.Element | null => {
  // 0 件、または 1 ページに収まるときは UI を出さない。
  if (totalCount === 0 || totalPages <= 1) return null;

  const visiblePages = computeVisiblePages(currentPage, totalPages);
  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalCount);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const buttonBase =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors";
  const navItem = cn(
    buttonBase,
    "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300 hover:text-brand-700",
  );
  const navItemDisabled = cn(
    buttonBase,
    "cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-300",
  );
  const navItemCurrent = cn(
    buttonBase,
    "border-brand-600 bg-brand-600 text-white hover:bg-brand-700",
  );

  return (
    <nav
      aria-label="ページネーション"
      className={cn(
        "flex flex-col items-center gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:justify-between",
        className,
      )}
    >
      <p className="text-xs text-neutral-600">
        {totalCount} 件中 {rangeStart} 〜 {rangeEnd} 件目（{currentPage} / {totalPages} ページ）
      </p>
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          {hasPrev ? (
            <Link
              href={buildHref(currentPage - 1) as never}
              aria-label="前のページ"
              rel="prev"
              prefetch={false}
              className={navItem}
            >
              前へ
            </Link>
          ) : (
            <span aria-disabled="true" className={navItemDisabled}>
              前へ
            </span>
          )}
        </li>
        {visiblePages.map((pageNumber) => {
          const isCurrent = pageNumber === currentPage;
          return (
            <li key={pageNumber}>
              {isCurrent ? (
                <span aria-current="page" className={navItemCurrent}>
                  {pageNumber}
                </span>
              ) : (
                <Link
                  href={buildHref(pageNumber) as never}
                  aria-label={`${pageNumber} ページ目`}
                  prefetch={false}
                  className={navItem}
                >
                  {pageNumber}
                </Link>
              )}
            </li>
          );
        })}
        <li>
          {hasNext ? (
            <Link
              href={buildHref(currentPage + 1) as never}
              aria-label="次のページ"
              rel="next"
              prefetch={false}
              className={navItem}
            >
              次へ
            </Link>
          ) : (
            <span aria-disabled="true" className={navItemDisabled}>
              次へ
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
};
