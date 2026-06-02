import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatedProperties } from "@/components/property/RelatedProperties";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

describe("RelatedProperties", () => {
  it("properties が空のときは null を返し、セクションを描画しない", () => {
    const { container } = render(<RelatedProperties properties={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("見出し「関連物件」と aria-labelledby のセクションを描画する", () => {
    render(<RelatedProperties properties={MOCK_PROPERTIES.slice(0, 2)} />);
    expect(screen.getByRole("heading", { name: "関連物件", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "関連物件" })).toBeInTheDocument();
  });

  it("渡した件数だけ PropertyCard を描画する", () => {
    const items = MOCK_PROPERTIES.slice(0, 3);
    render(<RelatedProperties properties={items} />);
    const cards = screen.getAllByTestId("property-card");
    expect(cards).toHaveLength(items.length);
  });

  it("1 件のみでも見出しと 1 カードを描画する", () => {
    const items = MOCK_PROPERTIES.slice(0, 1);
    render(<RelatedProperties properties={items} />);
    expect(screen.getByRole("heading", { name: "関連物件" })).toBeInTheDocument();
    expect(screen.getAllByTestId("property-card")).toHaveLength(1);
  });

  it("追加クラスを併合できる", () => {
    const { container } = render(
      <RelatedProperties properties={MOCK_PROPERTIES.slice(0, 1)} className="extra-cls" />,
    );
    const section = container.querySelector("section");
    expect(section?.className).toMatch(/extra-cls/);
  });

  it("最大件数の文言が件数に応じて変わる", () => {
    render(<RelatedProperties properties={MOCK_PROPERTIES.slice(0, 2)} />);
    expect(screen.getByText(/最大 2 件表示しています/)).toBeInTheDocument();
  });
});
