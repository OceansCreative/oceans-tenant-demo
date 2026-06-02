/**
 * `/robots.txt` 生成（App Router の MetadataRoute 規約）。
 *
 * デモ用途のため全クローラを全許可し、`sitemap` には `/sitemap.xml` を指定する。
 * 認証ページや管理画面が後段で増えた場合は `disallow` を個別に足す想定。
 */

import type { MetadataRoute } from "next";

const getBaseUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  const base = raw && raw.length > 0 ? raw : "http://localhost:3000";
  return base.replace(/\/$/, "");
};

const robots = (): MetadataRoute.Robots => {
  const baseUrl = getBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Sanity Studio のローカルプレビューはインデックス対象外にする。
        disallow: ["/studio", "/studio/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
};

export default robots;
