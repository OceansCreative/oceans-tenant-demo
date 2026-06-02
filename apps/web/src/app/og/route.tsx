/**
 * デフォルト OG 画像（トップページ / ブランド汎用）。
 *
 * - 1200×630 / edge runtime。
 * - 文言は `SITE_CONFIG.tagline` を中央タイトルに据える素朴なレイアウト。
 *   トップページの `metadata.openGraph.images` から参照する。
 */

import { renderOgImage } from "@/lib/seo/og";
import { SITE_CONFIG } from "@/lib/site";

export const runtime = "edge";

export const GET = async (): Promise<Response> => {
  return await renderOgImage({
    eyebrow: "店舗物件マッチング",
    title: SITE_CONFIG.tagline,
    meta: SITE_CONFIG.name,
  });
};
