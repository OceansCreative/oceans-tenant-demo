import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "@/components/layout/Header";
import { SITE_CONFIG } from "@/lib/site";

describe("Header", () => {
  it("ブランド名がリンクとしてレンダリングされる", () => {
    render(<Header />);
    const brand = screen.getByLabelText("OceansTenant トップへ");
    expect(brand).toBeInTheDocument();
    expect(brand).toHaveAttribute("href", "/");
  });

  it("主要ナビゲーションの全項目を表示する", () => {
    render(<Header />);
    for (const item of SITE_CONFIG.navigation) {
      const link = screen.getByRole("link", { name: item.label });
      expect(link).toHaveAttribute("href", item.href);
    }
  });

  it("「物件を登録」CTA は /agent/ingest に遷移する", () => {
    render(<Header />);
    const cta = screen.getByRole("link", { name: "物件を登録" });
    expect(cta).toHaveAttribute("href", "/agent/ingest");
  });

  it("モバイル用のメニューボタンに aria-label が設定されている", () => {
    render(<Header />);
    expect(screen.getByLabelText("メニューを開く")).toBeInTheDocument();
  });

  it("追加のクラス名を受け取って併合できる", () => {
    const { container } = render(<Header className="custom-cls" />);
    const headerEl = container.querySelector("header");
    expect(headerEl).not.toBeNull();
    expect(headerEl?.className).toMatch(/custom-cls/);
  });
});
