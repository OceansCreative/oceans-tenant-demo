/**
 * `buildPropertyJsonLd` / `serializeJsonLd` のユニットテスト。
 *
 * - mock データの全件で Zod 通過すること
 * - 必須フィールド（@context / @type / address / floorSize / offers）が揃うこと
 * - 価格通貨が "JPY"、面積単位が "m²" であること
 * - `</script>` インジェクションの危険シンボル `<` が文字列化時に Unicode エスケープされること
 * - 実在企業名・実在物件らしき文言が混入していないこと（CLAUDE.md 禁止事項の保険）
 */

import { describe, expect, it } from "vitest";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { buildPropertyJsonLd, jsonLdPropertySchema, serializeJsonLd } from "@/lib/seo/jsonld";

const BASE_URL = "https://example.com";

// 実在企業や有名物件名が万一混入したら検知するための簡易ブラックリスト。
// 「サンプル」等は許容するため、mock データの命名規約と衝突しない代表的固有名を狭く列挙。
const FORBIDDEN_TERMS = [
  "三井",
  "三菱",
  "住友",
  "野村",
  "東急",
  "ヒルズ",
  "丸の内",
  "Apple",
  "Google",
  "Starbucks",
];

describe("buildPropertyJsonLd", () => {
  it("mock 物件全件で Zod 検証を通過する", () => {
    for (const property of MOCK_PROPERTIES) {
      const jsonLd = buildPropertyJsonLd(property, BASE_URL);
      expect(jsonLd).not.toBeNull();
      const parsed = jsonLdPropertySchema.safeParse(jsonLd);
      expect(parsed.success).toBe(true);
    }
  });

  it("必須フィールドが揃い、通貨 / 面積単位が固定値である", () => {
    const property = MOCK_PROPERTIES[0];
    if (!property) {
      throw new Error("mock データが空です");
    }
    const jsonLd = buildPropertyJsonLd(property, BASE_URL);
    expect(jsonLd).not.toBeNull();
    if (!jsonLd) return;

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Place");
    expect(jsonLd.name).toBe(property.title);
    expect(jsonLd.url).toBe(`${BASE_URL}/properties/${property.slug}`);
    expect(jsonLd.address.addressRegion).toBe(property.address.prefecture);
    expect(jsonLd.address.addressLocality).toBe(property.address.city);
    expect(jsonLd.floorSize.unitText).toBe("m²");
    expect(jsonLd.floorSize.value).toBe(property.area);
    expect(jsonLd.offers.priceCurrency).toBe("JPY");
    expect(jsonLd.offers.price).toBe(property.rent);
  });

  it("緯度経度がある物件では geo が GeoCoordinates として出力される", () => {
    const property = MOCK_PROPERTIES[0];
    if (!property) throw new Error("mock データが空です");
    const jsonLd = buildPropertyJsonLd(property, BASE_URL);
    expect(jsonLd?.geo?.["@type"]).toBe("GeoCoordinates");
    expect(jsonLd?.geo?.latitude).toBe(property.address.geopoint.lat);
    expect(jsonLd?.geo?.longitude).toBe(property.address.geopoint.lng);
  });

  it("availability から Offer の availability URI を正しくマッピングする", () => {
    // mock データの availability ごとに対応 URI を確認する。
    const pickByAvailability = (target: "public" | "negotiating") =>
      MOCK_PROPERTIES.find((p) => p.availability === target);

    const pub = pickByAvailability("public");
    const neg = pickByAvailability("negotiating");
    expect(pub).toBeDefined();
    expect(neg).toBeDefined();
    if (!pub || !neg) return;

    expect(buildPropertyJsonLd(pub, BASE_URL)?.offers.availability).toBe(
      "https://schema.org/InStock",
    );
    expect(buildPropertyJsonLd(neg, BASE_URL)?.offers.availability).toBe(
      "https://schema.org/LimitedAvailability",
    );
  });

  it("末尾スラッシュ付き baseUrl でも正規化される", () => {
    const property = MOCK_PROPERTIES[0];
    if (!property) throw new Error("mock データが空です");
    const jsonLd = buildPropertyJsonLd(property, `${BASE_URL}/`);
    expect(jsonLd?.url).toBe(`${BASE_URL}/properties/${property.slug}`);
  });

  it("実在企業・有名物件らしき固有名が混入していない", () => {
    for (const property of MOCK_PROPERTIES) {
      const jsonLd = buildPropertyJsonLd(property, BASE_URL);
      const serialized = jsonLd ? serializeJsonLd(jsonLd) : "";
      for (const term of FORBIDDEN_TERMS) {
        expect(serialized.includes(term)).toBe(false);
      }
    }
  });
});

describe("serializeJsonLd", () => {
  it("`<` を Unicode エスケープして </script> インジェクションを防ぐ", () => {
    const property = MOCK_PROPERTIES[0];
    if (!property) throw new Error("mock データが空です");
    // description に意図的に `<` を含むケースを作る
    const tampered = { ...property, description: "悪意のある <script>alert(1)</script>" };
    const jsonLd = buildPropertyJsonLd(tampered, BASE_URL);
    expect(jsonLd).not.toBeNull();
    if (!jsonLd) return;
    const out = serializeJsonLd(jsonLd);
    expect(out.includes("<script")).toBe(false);
    expect(out.includes("\\u003c")).toBe(true);
  });

  it("JSON として再 parse 可能で、`@context` が schema.org を指す", () => {
    const property = MOCK_PROPERTIES[0];
    if (!property) throw new Error("mock データが空です");
    const jsonLd = buildPropertyJsonLd(property, BASE_URL);
    if (!jsonLd) throw new Error("JSON-LD 生成に失敗");
    const out = serializeJsonLd(jsonLd);
    // `<` のエスケープは JSON.parse でも復元される（標準動作）
    const parsedUnknown: unknown = JSON.parse(out);
    expect(
      typeof parsedUnknown === "object" &&
        parsedUnknown !== null &&
        "@context" in parsedUnknown &&
        (parsedUnknown as { "@context": unknown })["@context"] === "https://schema.org",
    ).toBe(true);
  });
});
