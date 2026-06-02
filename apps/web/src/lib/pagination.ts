/**
 * 検索結果ページネーション補助関数群。
 *
 * Server Component（page.tsx）と Client Component（SearchPagination）の双方から
 * 共有するため、`"use client"` ディレクティブを持たない独立モジュールとして配置する。
 */

const MAX_VISIBLE_PAGE_NUMBERS = 5;

/**
 * 表示するページ番号のリストを返す（現在ページを中央に最大 5 個）。
 *
 * 例:
 * - 総 10 ページ・現在 7 → [5, 6, 7, 8, 9]
 * - 総 10 ページ・現在 1 → [1, 2, 3, 4, 5]
 * - 総 3 ページ・現在 2 → [1, 2, 3]
 */
export const computeVisiblePages = (
  currentPage: number,
  totalPages: number,
): ReadonlyArray<number> => {
  if (totalPages <= MAX_VISIBLE_PAGE_NUMBERS) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const half = Math.floor(MAX_VISIBLE_PAGE_NUMBERS / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + MAX_VISIBLE_PAGE_NUMBERS - 1);
  start = Math.max(1, end - MAX_VISIBLE_PAGE_NUMBERS + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};
