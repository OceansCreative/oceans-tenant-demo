import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { renderWithI18n } from "../test-utils";

/**
 * Footer は v0.8.0 で next-intl の `useTranslations` を使う Client Component に変更された。
 * セクション数と外部リンクの a11y 属性は locale に依存しないので ja のみで検証し、
 * 翻訳キー切替動作は別ケース（locale=en）で確認する。
 */
describe("Footer", () => {
  it("サイト名が表示される（ja）", () => {
    renderWithI18n(<Footer />);
    expect(screen.getByText("OceansTenant")).toBeInTheDocument();
  });

  it("3 セクションの見出しがすべて表示される（ja）", () => {
    renderWithI18n(<Footer />);
    const titles = ["サービス", "事業者向け", "プロジェクト"];
    for (const title of titles) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it("外部リンクは noreferrer noopener 属性を持つ（ja）", () => {
    renderWithI18n(<Footer />);
    const github = screen.getByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("href", expect.stringContaining("github.com"));
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(github).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("内部リンクは Next.js Link で href が正しい（ja）", () => {
    renderWithI18n(<Footer />);
    const searchLink = screen.getByRole("link", { name: "物件検索" });
    expect(searchLink).toHaveAttribute("href", "/search");
  });

  it("コピーライト文言が含まれる（ja）", () => {
    renderWithI18n(<Footer />);
    expect(screen.getByText(/OceansBase/)).toBeInTheDocument();
  });

  it("locale=en を渡すと英語表示になる", () => {
    renderWithI18n(<Footer />, { locale: "en" });
    expect(screen.getByRole("heading", { level: 2, name: "Service" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "For agents" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Property search" })).toBeInTheDocument();
  });
});
