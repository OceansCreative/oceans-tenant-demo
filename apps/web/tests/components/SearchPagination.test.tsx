import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchPagination } from "@/components/search/SearchPagination";
import jaMessages from "../../messages/ja.json";
import { renderWithI18n } from "../test-utils";

const t = jaMessages.search.pagination;

/**
 * テスト用に「全ページの href を簡単に生成する」ヘルパ。
 * Server Component 側では `computeVisiblePages` で必要な範囲のみを渡すが、
 * テストでは API の振る舞いに集中するため全ページ分を投入する。
 */
const buildAllHrefs = (totalPages: number): ReadonlyArray<readonly [number, string]> =>
  Array.from({ length: totalPages }, (_, i) => [i + 1, `/search?page=${i + 1}`] as const);

describe("SearchPagination", () => {
  it("totalCount=0 のときは何もレンダリングしない", () => {
    const { container } = renderWithI18n(
      <SearchPagination currentPage={1} totalPages={0} totalCount={0} pageSize={20} hrefs={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("総ページ数が 1 のときは何もレンダリングしない", () => {
    const { container } = renderWithI18n(
      <SearchPagination
        currentPage={1}
        totalPages={1}
        totalCount={5}
        pageSize={20}
        hrefs={buildAllHrefs(1)}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("nav aria-label が「ページネーション」", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={1}
        totalPages={3}
        totalCount={45}
        pageSize={20}
        hrefs={buildAllHrefs(3)}
      />,
    );
    expect(screen.getByRole("navigation", { name: t.ariaLabel })).toBeInTheDocument();
  });

  it("「N 件中 i 〜 j 件目」表示が正しい（1 ページ目）", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={1}
        totalPages={3}
        totalCount={45}
        pageSize={20}
        hrefs={buildAllHrefs(3)}
      />,
    );
    expect(screen.getByText(/45 件中 1 〜 20 件目（1 \/ 3 ページ）/)).toBeInTheDocument();
  });

  it("「N 件中 i 〜 j 件目」表示が正しい（最終ページの端数）", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={3}
        totalPages={3}
        totalCount={45}
        pageSize={20}
        hrefs={buildAllHrefs(3)}
      />,
    );
    expect(screen.getByText(/45 件中 41 〜 45 件目（3 \/ 3 ページ）/)).toBeInTheDocument();
  });

  it("現在ページに aria-current=page を付与する", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={2}
        totalPages={3}
        totalCount={45}
        pageSize={20}
        hrefs={buildAllHrefs(3)}
      />,
    );
    const currentPageMarker = screen.getByText("2", { selector: "[aria-current='page']" });
    expect(currentPageMarker).toBeInTheDocument();
  });

  it("1 ページ目のとき「前へ」はリンクではなく aria-disabled の span", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={1}
        totalPages={3}
        totalCount={45}
        pageSize={20}
        hrefs={buildAllHrefs(3)}
      />,
    );
    expect(screen.queryByRole("link", { name: t.prevAriaLabel })).toBeNull();
    const prev = screen.getByText(t.prev);
    expect(prev.getAttribute("aria-disabled")).toBe("true");
  });

  it("最終ページのとき「次へ」はリンクではなく aria-disabled の span", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={3}
        totalPages={3}
        totalCount={45}
        pageSize={20}
        hrefs={buildAllHrefs(3)}
      />,
    );
    expect(screen.queryByRole("link", { name: t.nextAriaLabel })).toBeNull();
    const next = screen.getByText(t.next);
    expect(next.getAttribute("aria-disabled")).toBe("true");
  });

  it("「前へ」「次へ」リンクは hrefs から該当ページの URL を引く", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={2}
        totalPages={5}
        totalCount={100}
        pageSize={20}
        hrefs={buildAllHrefs(5)}
      />,
    );
    expect(screen.getByRole("link", { name: t.prevAriaLabel })).toHaveAttribute(
      "href",
      "/search?page=1",
    );
    expect(screen.getByRole("link", { name: t.nextAriaLabel })).toHaveAttribute(
      "href",
      "/search?page=3",
    );
  });

  it("ページ番号リンクは hrefs から該当 URL を引く", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={2}
        totalPages={5}
        totalCount={100}
        pageSize={20}
        hrefs={buildAllHrefs(5)}
      />,
    );
    expect(screen.getByRole("link", { name: "1 ページ目" })).toHaveAttribute(
      "href",
      "/search?page=1",
    );
    expect(screen.getByRole("link", { name: "3 ページ目" })).toHaveAttribute(
      "href",
      "/search?page=3",
    );
  });

  it("総ページ数が多いときは現在ページを中心に最大 5 個まで表示", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={10}
        totalPages={20}
        totalCount={400}
        pageSize={20}
        hrefs={buildAllHrefs(20)}
      />,
    );
    // 8, 9, 10, 11, 12 が表示される（現在ページ 10 を中心に 5 個）
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByText("7")).toBeNull();
    expect(screen.queryByText("13")).toBeNull();
  });

  it("locale=en では英語のラベルが適用される", () => {
    renderWithI18n(
      <SearchPagination
        currentPage={1}
        totalPages={3}
        totalCount={45}
        pageSize={20}
        hrefs={buildAllHrefs(3)}
      />,
      { locale: "en" },
    );
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByText(/1–20 of 45/)).toBeInTheDocument();
  });
});
