import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { IngestForm } from "@/components/agent/IngestForm";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { PropertyMap } from "@/components/map/PropertyMap";
import { AvailabilityBadge } from "@/components/property/AvailabilityBadge";
import { PropertyCard } from "@/components/property/PropertyCard";
import { RelatedProperties } from "@/components/property/RelatedProperties";
import { FilterChips } from "@/components/search/FilterChips";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchFilter } from "@/components/search/SearchFilter";
import { SearchPagination } from "@/components/search/SearchPagination";
import { ViewModeToggle } from "@/components/search/ViewModeToggle";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

// next/navigation は jsdom 環境では未提供のため、最低限のフックを差し替える。
// SearchBar / SearchFilter / ViewModeToggle / FilterChips で必要になるため一括で mock しておく。
// FilterChips の chip 描画分岐をカバーするため、適用中フィルタ付きの URL を返すバージョンも用意。
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => ({
    toString: () => "prefecture=東京都&buildingType=street_level&minRent=300000",
    get: (key: string) =>
      new URLSearchParams("prefecture=東京都&buildingType=street_level&minRent=300000").get(key),
  }),
  usePathname: () => "/",
}));

const [firstProperty] = MOCK_PROPERTIES;
if (!firstProperty) throw new Error("MOCK_PROPERTIES が空です");

describe("a11y: 主要コンポーネントは axe 違反を出さない", () => {
  it("Header: ランドマークと aria 属性が適切", async () => {
    const { container } = render(<Header />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Footer: 各セクションが nav として識別可能", async () => {
    const { container } = render(<Footer />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("PropertyCard: タイトルリンク + バッジが a11y 適合", async () => {
    const { container } = render(<PropertyCard property={firstProperty} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("AvailabilityBadge (public): ARIA 違反なし", async () => {
    const { container } = render(<AvailabilityBadge availability="public" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("AvailabilityBadge (negotiating): ARIA 違反なし", async () => {
    const { container } = render(<AvailabilityBadge availability="negotiating" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("AvailabilityBadge (closed): ARIA 違反なし", async () => {
    const { container } = render(<AvailabilityBadge availability="closed" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SearchPagination: nav とリンクが識別可能", async () => {
    const { container } = render(
      <SearchPagination
        currentPage={2}
        totalPages={5}
        totalCount={100}
        pageSize={20}
        buildHref={(page) => `/search?page=${page}`}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SearchBar: search role + label が機能", async () => {
    const { container } = render(<SearchBar />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SearchFilter: フィルタの fieldset/legend/label が a11y 適合", async () => {
    const { container } = render(<SearchFilter />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ViewModeToggle: 表示モード切替が a11y 適合", async () => {
    const { container } = render(<ViewModeToggle current="list" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("PropertyMap (API キー未設定時): fallback UI が a11y 適合", async () => {
    const { container } = render(<PropertyMap properties={MOCK_PROPERTIES.slice(0, 3)} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("IngestForm: URL 入力 + 送信が a11y 適合", async () => {
    const { container } = render(<IngestForm />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("RelatedProperties: 関連物件セクションが a11y 適合", async () => {
    const { container } = render(<RelatedProperties properties={MOCK_PROPERTIES.slice(0, 3)} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("FilterChips: 適用中フィルタ chip が a11y 適合", async () => {
    const { container } = render(<FilterChips />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
