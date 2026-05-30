import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PropertyCard } from "@/components/property/PropertyCard";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

const [first, _osakaProp] = MOCK_PROPERTIES;
if (!first) throw new Error("MOCK_PROPERTIES is empty");

describe("PropertyCard", () => {
  it("タイトルがリンクとしてレンダリングされる", () => {
    render(<PropertyCard property={first} />);
    const link = screen.getByRole("link", { name: first.title });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", `/properties/${first.slug}`);
  });

  it("住所と最寄り駅が表示される", () => {
    render(<PropertyCard property={first} />);
    expect(screen.getByText(/新宿区/)).toBeInTheDocument();
    const station = first.nearestStations[0];
    if (!station) throw new Error("Expected at least one station in fixture");
    // 最寄り駅は「<路線> <駅名> 駅 徒歩 N 分」形式で表示される
    expect(
      screen.getByText(
        new RegExp(`${station.line}.*${station.station}.*徒歩 ${station.walkMinutes} 分`),
      ),
    ).toBeInTheDocument();
  });

  it("availability に応じたバッジが表示される", () => {
    render(<PropertyCard property={first} />);
    expect(screen.getByText("公開中")).toBeInTheDocument();
  });

  it("特徴タグは先頭 3 件まで表示される", () => {
    render(<PropertyCard property={first} />);
    for (const feature of first.features.slice(0, 3)) {
      expect(screen.getByText(feature)).toBeInTheDocument();
    }
  });

  it("坪数と㎡が表示される", () => {
    render(<PropertyCard property={first} />);
    expect(screen.getByText(/㎡/)).toBeInTheDocument();
    expect(screen.getByText(/坪/)).toBeInTheDocument();
  });

  it("追加クラスを併合できる", () => {
    const { container } = render(<PropertyCard property={first} className="ring-2" />);
    const article = container.querySelector("article");
    expect(article?.className).toMatch(/ring-2/);
  });
});
