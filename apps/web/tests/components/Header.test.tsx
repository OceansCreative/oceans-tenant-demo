import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "@/components/layout/Header";
import { renderWithI18n } from "../test-utils";

/**
 * Header は v0.8.0 で next-intl の `useTranslations` を使う Client Component に変更された。
 * 日本語 / 英語の両方で表示を確認することで、翻訳キーの抜けがないかも検出する。
 */
describe("Header", () => {
  it("ブランド名がリンクとしてレンダリングされる（ja）", () => {
    renderWithI18n(<Header />);
    const brand = screen.getByLabelText("OceansTenant トップへ");
    expect(brand).toBeInTheDocument();
    expect(brand).toHaveAttribute("href", "/");
  });

  it("主要ナビゲーションの全項目を表示する（ja）", () => {
    renderWithI18n(<Header />);
    const items = [
      { href: "/", label: "ホーム" },
      { href: "/search", label: "物件を探す" },
      { href: "/chat", label: "対話で探す" },
      { href: "/agent", label: "不動産会社" },
    ];
    for (const item of items) {
      const link = screen.getByRole("link", { name: item.label });
      expect(link).toHaveAttribute("href", item.href);
    }
  });

  it("「物件を登録」CTA は /agent/ingest に遷移する（ja）", () => {
    renderWithI18n(<Header />);
    const cta = screen.getByRole("link", { name: "物件を登録" });
    expect(cta).toHaveAttribute("href", "/agent/ingest");
  });

  it("モバイル用のメニューボタンに aria-label が設定されている（ja）", () => {
    renderWithI18n(<Header />);
    expect(screen.getByLabelText("メニューを開く")).toBeInTheDocument();
  });

  it("追加のクラス名を受け取って併合できる", () => {
    const { container } = renderWithI18n(<Header className="custom-cls" />);
    const headerEl = container.querySelector("header");
    expect(headerEl).not.toBeNull();
    expect(headerEl?.className).toMatch(/custom-cls/);
  });

  it("LocaleSwitcher（言語切替セレクト）が表示される", () => {
    renderWithI18n(<Header />);
    // LocaleSwitcher の visible label は sr-only。aria-label でアクセスする。
    expect(screen.getByRole("combobox", { name: "言語" })).toBeInTheDocument();
  });

  it("locale=en を渡すと英語表示になる", () => {
    renderWithI18n(<Header />, { locale: "en" });
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "List a property" })).toBeInTheDocument();
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });
});
