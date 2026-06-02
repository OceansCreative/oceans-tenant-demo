/**
 * `next/og` 共通レイアウト helper。
 *
 * 設計方針:
 * - 1200×630（OGP / Twitter Card 標準）の固定サイズで返す。
 * - フォントは Google Fonts から Noto Sans JP の Bold/Regular を fetch して `ArrayBuffer` 化する。
 *   ネットワーク失敗時は `fetch` の例外を握りつぶし、`fonts` 未指定（システムフォント）で生成
 *   する fallback とする。OG 画像は SEO 補助であり、デモ環境のフォント取得失敗で全体が
 *   500 になるのを避けるための保守的設計。
 * - 装飾は最小限（白背景 + ブランドカラーのアクセントバー + テキスト 2-3 行）に留める。
 *   ロゴ画像を持たないため、ヘッダーは "OceansTenant" のテキストロゴで代替する。
 *
 * 注意: 本ファイルは `next/og` の `ImageResponse` 経由でのみ JSX を返す前提のため、
 * 通常のクライアントコンポーネントとしては使用しない（edge runtime で動作）。
 */

import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const BRAND_PRIMARY = "#0d6df0";
const NEUTRAL_900 = "#0a0a0a";
const NEUTRAL_600 = "#525252";

/**
 * Google Fonts から Noto Sans JP の指定 weight を取得する。
 *
 * 失敗時は `null` を返し、呼び出し側は `fonts` 未指定で `ImageResponse` を返す。
 */
const loadNotoSansJp = async (weight: 400 | 700): Promise<ArrayBuffer | null> => {
  // Google Fonts CSS API。`text=` パラメータでサブセットすると軽量化できるが、
  // 動的テキストの全字種を URL 化すると CDN キャッシュが効きにくいので、ここでは
  // フルセット相当を取得する（OG 画像 1 枚 = 短時間レンダリングなので許容）。
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&display=swap`;
  try {
    const cssRes = await fetch(cssUrl, {
      headers: {
        // 一部の UA でないと WOFF2 を返さないため UA を明示する。
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)",
      },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src:\s*url\((https:\/\/[^)]+\.(?:woff2|ttf|otf))\)/);
    if (!match || !match[1]) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch (error: unknown) {
    console.error("[seo/og] Noto Sans JP の取得に失敗 (system font fallback)", error);
    return null;
  }
};

/**
 * OG 画像レイアウト共通スロット。
 *
 * - `eyebrow`: 上部の小さな見出し（例: "OceansTenant" / 物件種別）
 * - `title`: 中央の主要テキスト（最大 2 行を想定）
 * - `meta`: 下部の補足行（例: rent + city / 検索条件サマリ）
 */
type OgSlots = {
  readonly eyebrow: string;
  readonly title: string;
  readonly meta?: string;
};

const OgLayout = ({ eyebrow, title, meta }: OgSlots): ReactElement => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        padding: "64px 80px",
        fontFamily: "NotoSansJP, sans-serif",
        position: "relative",
      }}
    >
      {/* 左端のブランドカラーアクセントバー */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 12,
          backgroundColor: BRAND_PRIMARY,
        }}
      />

      {/* ヘッダー: テキストロゴ + eyebrow */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: BRAND_PRIMARY,
            letterSpacing: "-0.01em",
          }}
        >
          OceansTenant
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: NEUTRAL_600,
          }}
        >
          {eyebrow}
        </span>
      </div>

      {/* 中央: タイトル */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        <h1
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: NEUTRAL_900,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            margin: 0,
            // 2 行を超える長文物件名は visually truncate（next/og は CSS line-clamp 一部対応）。
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </h1>
      </div>

      {/* フッター: meta + ブランドカラーバー */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {meta !== undefined && (
          <p
            style={{
              fontSize: 28,
              fontWeight: 400,
              color: NEUTRAL_600,
              margin: 0,
            }}
          >
            {meta}
          </p>
        )}
        <div
          style={{
            height: 6,
            width: 96,
            backgroundColor: BRAND_PRIMARY,
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
};

/**
 * OG 画像 `ImageResponse` を返す。フォント取得失敗時はシステムフォントで描画する。
 */
export const renderOgImage = async (slots: OgSlots): Promise<ImageResponse> => {
  const [regular, bold] = await Promise.all([loadNotoSansJp(400), loadNotoSansJp(700)]);

  const fonts: Array<{
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: "normal";
  }> = [];
  if (regular) fonts.push({ name: "NotoSansJP", data: regular, weight: 400, style: "normal" });
  if (bold) fonts.push({ name: "NotoSansJP", data: bold, weight: 700, style: "normal" });

  return new ImageResponse(<OgLayout {...slots} />, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    ...(fonts.length > 0 ? { fonts } : {}),
  });
};

export const OG_DIMENSIONS = { width: OG_WIDTH, height: OG_HEIGHT } as const;
