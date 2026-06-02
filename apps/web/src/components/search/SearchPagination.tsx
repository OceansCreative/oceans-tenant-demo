"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { computeVisiblePages } from "@/lib/pagination";

type SearchPaginationProps = {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly totalCount: number;
  readonly pageSize: number;
  /**
   * `[page, href]` のリスト。Server Component 側で `serializeSearchCriteria` の結果と
   * view パラメータを織り込んだ最終 URL を事前計算しておく。
   *
   * v0.9.0 で `useTranslations()` を使うため Client Component 化した結果、
   * 親 Server Component から関数 prop を渡せなくなったため、配列に変更した。
   * 配列は必要なページ番号（前/次/可視ページ）のみを含む。
   */
  readonly hrefs: ReadonlyArray<readonly [page: number, href: string]>;
  readonly className?: string;
};

/**
 * 検索結果ページネーション UI。
 *
 * - `<Link>` を出力するため、JS なしでもナビゲート可能（v0.9.0 で Client 化したのは
 *   `useTranslations()` 利用のため。リンク自体は引き続き <a> ベースで遷移する）
 * - 総件数が 0 のときは何も出さない（呼び出し側で 0 件 UI を出す前提）
 * - a11y: `<nav aria-label="ページネーション">` で囲み、現在ページに `aria-current="page"`
 *
 * Phase 3 で GROQ ベースに切り替わっても、`hrefs` を差し替えるだけで再利用できる。
 * 表示対象ページの計算ロジックは `@/lib/pagination` に切り出し、Server / Client
 * の双方から呼び出せるようにしている（Server Component から事前計算するため）。
 */

export const SearchPagination = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  hrefs,
  className,
}: SearchPaginationProps): React.JSX.Element | null => {
  const t = useTranslations("search.pagination");
  // 0 件、または 1 ページに収まるときは UI を出さない。
  if (totalCount === 0 || totalPages <= 1) return null;

  const hrefMap = new Map(hrefs);
  const visiblePages = computeVisiblePages(currentPage, totalPages);
  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalCount);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const prevHref = hrefMap.get(currentPage - 1);
  const nextHref = hrefMap.get(currentPage + 1);

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
      aria-label={t("ariaLabel")}
      className={cn(
        "flex flex-col items-center gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:justify-between",
        className,
      )}
    >
      <p className="text-xs text-neutral-600">
        {t("summary", {
          total: totalCount,
          start: rangeStart,
          end: rangeEnd,
          current: currentPage,
          pages: totalPages,
        })}
      </p>
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          {hasPrev && prevHref ? (
            <Link
              href={prevHref as never}
              aria-label={t("prevAriaLabel")}
              rel="prev"
              prefetch={false}
              className={navItem}
            >
              {t("prev")}
            </Link>
          ) : (
            <span aria-disabled="true" className={navItemDisabled}>
              {t("prev")}
            </span>
          )}
        </li>
        {visiblePages.map((pageNumber) => {
          const isCurrent = pageNumber === currentPage;
          const href = hrefMap.get(pageNumber);
          return (
            <li key={pageNumber}>
              {isCurrent || !href ? (
                <span
                  aria-current={isCurrent ? "page" : undefined}
                  className={isCurrent ? navItemCurrent : navItemDisabled}
                >
                  {pageNumber}
                </span>
              ) : (
                <Link
                  href={href as never}
                  aria-label={t("pageAriaLabel", { page: pageNumber })}
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
          {hasNext && nextHref ? (
            <Link
              href={nextHref as never}
              aria-label={t("nextAriaLabel")}
              rel="next"
              prefetch={false}
              className={navItem}
            >
              {t("next")}
            </Link>
          ) : (
            <span aria-disabled="true" className={navItemDisabled}>
              {t("next")}
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
};
