/**
 * 物件詳細ページに埋め込む JSON-LD（schema.org）を生成する helper。
 *
 * 設計方針:
 * - 構造は Zod (`jsonLdPropertySchema`) で型を強制し、欠損や型不一致を実行時にも検出する。
 *   検索エンジン側に壊れた構造化データが流れるのを防ぐため、`safeParse` 失敗時は `null` を返し
 *   呼び出し側は `<script>` 描画自体をスキップする。
 * - 単一の物件オブジェクトを `Place` で表現し、賃料は `Offer`（`priceCurrency: "JPY"`）、
 *   面積は `QuantitativeValue`（`unitText: "m²"`）にネストする。Google の構造化データ
 *   テストツールがそのまま読める標準形に揃えた。
 * - mock データ（`apps/web/src/lib/sanity/mock-properties.ts`）からは実在企業名や実在物件
 *   情報を一切引かないため、本 helper も `title` / `description` / `address` を素のまま渡すだけ。
 *   実 Sanity 接続後も同じシリアライザを使うため、危険値の混入が発生しないよう
 *   `description` 等は schema 側で文字列化のみ行う（HTML 構造を入れない）。
 */

import type { PropertyWithTsubo } from "@oceans-tenant/shared";
import { z } from "zod";

const postalAddressSchema = z
  .object({
    "@type": z.literal("PostalAddress"),
    addressCountry: z.literal("JP"),
    addressRegion: z.string().min(1),
    addressLocality: z.string().min(1),
    streetAddress: z.string().optional(),
  })
  .strict();

const geoCoordinatesSchema = z
  .object({
    "@type": z.literal("GeoCoordinates"),
    latitude: z.number(),
    longitude: z.number(),
  })
  .strict();

const quantitativeValueSchema = z
  .object({
    "@type": z.literal("QuantitativeValue"),
    value: z.number().positive(),
    unitText: z.literal("m²"),
  })
  .strict();

const offerSchema = z
  .object({
    "@type": z.literal("Offer"),
    priceCurrency: z.literal("JPY"),
    price: z.number().nonnegative(),
    availability: z.string().min(1),
    url: z.string().url(),
  })
  .strict();

/**
 * 物件 1 件分の JSON-LD 構造（schema.org の `Place` をベース）。
 *
 * - `@context` / `@type` は固定リテラルとし、Zod で literal 検証する
 * - `address` / `floorSize` / `offers` は必須（賃料・住所・面積は mock データでも必ず存在する）
 * - `geo` は緯度経度がある時のみ付与（mock では全件あるが、将来の Sanity データで欠ける可能性に備える）
 */
export const jsonLdPropertySchema = z
  .object({
    "@context": z.literal("https://schema.org"),
    "@type": z.literal("Place"),
    name: z.string().min(1),
    description: z.string().optional(),
    url: z.string().url(),
    address: postalAddressSchema,
    geo: geoCoordinatesSchema.optional(),
    floorSize: quantitativeValueSchema,
    offers: offerSchema,
  })
  .strict();

export type JsonLdProperty = z.infer<typeof jsonLdPropertySchema>;

/**
 * Sanity 側の `availability` 値を schema.org の Offer availability URI に対応付ける。
 *
 * `public` → InStock / `negotiating` → LimitedAvailability / `private` → OutOfStock。
 * 検索エンジン側にデモ用ステータスの意味合いをそのまま伝えるためのざっくり対応。
 */
const offerAvailabilityFromStatus = (availability: PropertyWithTsubo["availability"]): string => {
  switch (availability) {
    case "public":
      return "https://schema.org/InStock";
    case "negotiating":
      return "https://schema.org/LimitedAvailability";
    case "private":
      return "https://schema.org/OutOfStock";
    default: {
      // exhaustive check — 将来 enum が増えたら型エラーで気付ける
      const _exhaustive: never = availability;
      return _exhaustive;
    }
  }
};

/**
 * `PropertyWithTsubo` から JSON-LD オブジェクトを生成する。
 *
 * - `baseUrl` は canonical 用に末尾スラッシュなしを期待する（呼び出し側で正規化）。
 * - 生成後に `jsonLdPropertySchema.safeParse` を通し、検証失敗時は `null` を返す。
 *   呼び出し側はこの戻り値で `<script>` 出力の有無を判断する。
 */
export const buildPropertyJsonLd = (
  property: PropertyWithTsubo,
  baseUrl: string,
): JsonLdProperty | null => {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const url = `${normalizedBase}/properties/${property.slug}`;

  const candidate: JsonLdProperty = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: property.title,
    description: property.description,
    url,
    address: {
      "@type": "PostalAddress",
      addressCountry: "JP",
      addressRegion: property.address.prefecture,
      addressLocality: property.address.city,
      streetAddress: property.address.streetAddress,
    },
    geo: property.address.geopoint
      ? {
          "@type": "GeoCoordinates",
          latitude: property.address.geopoint.lat,
          longitude: property.address.geopoint.lng,
        }
      : undefined,
    floorSize: {
      "@type": "QuantitativeValue",
      value: property.area,
      unitText: "m²",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "JPY",
      price: property.rent,
      availability: offerAvailabilityFromStatus(property.availability),
      url,
    },
  };

  const parsed = jsonLdPropertySchema.safeParse(candidate);
  if (!parsed.success) {
    console.error("[seo/jsonld] JSON-LD の Zod 検証に失敗", parsed.error.flatten());
    return null;
  }
  return parsed.data;
};

/**
 * `<script type="application/ld+json">` 内に埋め込むための文字列化。
 *
 * `</script>` を含む文字列が万一入り込むと HTML パースが壊れるので、`<` を Unicode エスケープ
 * して安全化する（OWASP 推奨パターン）。
 */
export const serializeJsonLd = (jsonLd: JsonLdProperty): string =>
  JSON.stringify(jsonLd).replace(/</g, "\\u003c");
