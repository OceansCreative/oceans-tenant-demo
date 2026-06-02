/**
 * 物件詳細用 OG 画像。
 *
 * - 1200×630 / edge runtime。
 * - 動的セグメント `[slug]` から mock データを検索し、見つからなければ 404 を返す。
 * - 中央タイトルに物件名、下部 meta に「賃料 / 所在地」をコンパクトに表示する。
 *
 * mock 経路に依存している点は意図通り。実 Sanity 接続時は edge runtime で動く GROQ
 * フェッチャに置き換えれば良い（v0.5.0 では mock のみで完結させる）。
 */

import { formatAddressSummary, formatJpy } from "@/lib/format";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { renderOgImage } from "@/lib/seo/og";

export const runtime = "edge";

type Params = {
  readonly params: Promise<{ slug: string }>;
};

export const GET = async (_request: Request, { params }: Params): Promise<Response> => {
  const { slug } = await params;
  const property = MOCK_PROPERTIES.find((p) => p.slug === slug);
  if (!property) {
    return new Response("Not Found", { status: 404 });
  }

  return await renderOgImage({
    eyebrow: "物件詳細",
    title: property.title,
    meta: `${formatJpy(property.rent)} / ${formatAddressSummary(property.address)}`,
  });
};
