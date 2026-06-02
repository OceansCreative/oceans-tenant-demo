/**
 * `/sitemap.xml` 生成（App Router の MetadataRoute 規約）。
 *
 * 設計方針:
 * - 静的ページ（`/`, `/search`, `/chat`）と mock 物件詳細 5 件を列挙する。
 *   実 Sanity 接続時は `MOCK_PROPERTIES` を `fetchProperties` に置き換えれば slug が自動で
 *   全件展開される。デモ環境では mock を使い、CI ビルドだけで完結させる。
 * - `lastModified` は物件の `publishedAt` を使用し、それ以外は build 時刻を使用する。
 * - `changeFrequency` / `priority` は SEO 補助情報（Google は参考値扱い）。物件詳細を
 *   最も高い `0.8`、検索一覧 / 対話を `0.7`、トップを `1.0` とする。
 */

import type { MetadataRoute } from "next";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

const getBaseUrl = (): string => {
  // 空文字も localhost にフォールバック（CI で env を unset したい場合への配慮）。
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  const base = raw && raw.length > 0 ? raw : "http://localhost:3000";
  return base.replace(/\/$/, "");
};

const sitemap = (): MetadataRoute.Sitemap => {
  const baseUrl = getBaseUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/chat`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  const propertyEntries: MetadataRoute.Sitemap = MOCK_PROPERTIES.map((property) => ({
    url: `${baseUrl}/properties/${property.slug}`,
    lastModified: new Date(property.publishedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...propertyEntries];
};

export default sitemap;
