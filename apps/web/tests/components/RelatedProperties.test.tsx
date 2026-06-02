import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatedProperties } from "@/components/property/RelatedProperties";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import jaMessages from "../../messages/ja.json";
import { renderWithI18n } from "../test-utils";

const tRelated = jaMessages.property.related;

describe("RelatedProperties", () => {
  it("properties が空のときは null を返し、セクションを描画しない", () => {
    const { container } = renderWithI18n(<RelatedProperties properties={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("見出し「関連物件」と aria-labelledby のセクションを描画する", () => {
    renderWithI18n(<RelatedProperties properties={MOCK_PROPERTIES.slice(0, 2)} />);
    expect(screen.getByRole("heading", { name: tRelated.heading, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: tRelated.heading })).toBeInTheDocument();
  });

  it("渡した件数だけ PropertyCard を描画する", () => {
    const items = MOCK_PROPERTIES.slice(0, 3);
    renderWithI18n(<RelatedProperties properties={items} />);
    const cards = screen.getAllByTestId("property-card");
    expect(cards).toHaveLength(items.length);
  });

  it("1 件のみでも見出しと 1 カードを描画する", () => {
    const items = MOCK_PROPERTIES.slice(0, 1);
    renderWithI18n(<RelatedProperties properties={items} />);
    expect(screen.getByRole("heading", { name: tRelated.heading })).toBeInTheDocument();
    expect(screen.getAllByTestId("property-card")).toHaveLength(1);
  });

  it("追加クラスを併合できる", () => {
    const { container } = renderWithI18n(
      <RelatedProperties properties={MOCK_PROPERTIES.slice(0, 1)} className="extra-cls" />,
    );
    const section = container.querySelector("section");
    expect(section?.className).toMatch(/extra-cls/);
  });

  it("最大件数の文言が件数に応じて変わる", () => {
    renderWithI18n(<RelatedProperties properties={MOCK_PROPERTIES.slice(0, 2)} />);
    expect(screen.getByText(/最大\s*2\s*件表示しています/)).toBeInTheDocument();
  });

  it("locale=en では英語の見出し / 説明文に切り替わる", () => {
    renderWithI18n(<RelatedProperties properties={MOCK_PROPERTIES.slice(0, 2)} />, {
      locale: "en",
    });
    expect(screen.getByRole("heading", { name: "Related properties" })).toBeInTheDocument();
    expect(screen.getByText(/Showing up to 2 properties/)).toBeInTheDocument();
  });
});
