import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { SITE_CONFIG } from "@/lib/site";

describe("Footer", () => {
  it("サイト名が表示される", () => {
    render(<Footer />);
    expect(screen.getByText(SITE_CONFIG.name)).toBeInTheDocument();
  });

  it("3 セクションの見出しがすべて表示される", () => {
    render(<Footer />);
    for (const section of SITE_CONFIG.footer.sections) {
      expect(screen.getByRole("heading", { level: 2, name: section.title })).toBeInTheDocument();
    }
  });

  it("外部リンクは noreferrer noopener 属性を持つ", () => {
    render(<Footer />);
    const github = screen.getByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("href", expect.stringContaining("github.com"));
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(github).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("内部リンクは Next.js Link で href が正しい", () => {
    render(<Footer />);
    const searchLink = screen.getByRole("link", { name: "物件検索" });
    expect(searchLink).toHaveAttribute("href", "/search");
  });

  it("コピーライト文言が含まれる", () => {
    render(<Footer />);
    expect(screen.getByText(/OceansBase/)).toBeInTheDocument();
  });
});
