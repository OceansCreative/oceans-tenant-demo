import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isBasePathEnabled = process.env.OCEANS_BASEPATH === "/tenant-search";

/**
 * next-intl のプラグイン。`src/i18n/request.ts` を `getRequestConfig` のエントリとして
 * 登録し、RSC レンダリング時に locale と messages を解決させる。
 * v0.8.0 で導入（URL prefix を使わず cookie ベースで locale を保持）。
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * monorepo の `packages/shared` は ESM/NodeNext 互換のため、`.ts` ファイルを
 * `.js` 拡張子付きで内部 import している（例: `export * from "./tsubo.js"`）。
 *
 * このため、bundler 側で「`.js` 指定の import を `.ts` にも解決」する設定が必要になる。
 * webpack では `resolve.extensionAlias` で実現できるが、Turbopack には現状
 * 完全相当の API が存在しない（vercel/next.js Issue #82945 / PR #92685 で
 * `extensionAlias` 相当オプションの追加が進行中。2026/06 時点で未リリース）。
 *
 * 設定方針:
 *  - webpack: `extensionAlias` で `.js` → `.ts/.tsx/.js` を明示する（現状の主 build 経路）。
 *  - Turbopack: `resolveExtensions` のデフォルト順に `.ts` / `.tsx` を含め、拡張子省略時の
 *    挙動を webpack と揃える予防設定のみ追加する。明示 `.js` 拡張子付き import を `.ts`
 *    に解決する挙動は Turbopack 側で未対応のため、`next build --turbopack` は
 *    Issue #82945 解決まで失敗する（`next-build-webpack` 経路を維持）。
 *
 * Next.js 16 で Turbopack が build 既定化された際は、Issue #82945 解決後に
 * `turbopack.resolveAlias` などで正式対応を追加し、webpack 側設定を削除する想定。
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // gzip 圧縮を明示有効化（v0.6.0 WS-2 / Lighthouse Performance 改善）。
  // Vercel では Edge が brotli/gzip を自動付与するため二重圧縮にはならず、
  // `next start` での self-host 計測時にも HTML / JS / CSS に gzip が適用される。
  compress: true,
  ...(isBasePathEnabled ? { basePath: "/tenant-search", assetPrefix: "/tenant-search" } : {}),
  experimental: {
    typedRoutes: true,
    // 大規模パッケージのバレル import をルート別に最適化し、初回 JS バンドルを縮小する。
    // `@vis.gl/react-google-maps` は /search（地図モード）と物件詳細でのみ使うため、
    // 不要 export を除去して initial bundle を削減する（v0.6.0 WS-2）。
    optimizePackageImports: ["@vis.gl/react-google-maps"],
  },
  images: {
    // Sanity CDN を許可しつつ、modern image format で配信できるよう avif / webp を優先する。
    // OG 画像（`next/og`）や docs/images の PNG は `next/image` を介さないため対象外。
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
  // Turbopack 用の解決設定（Next.js 15.3+ でトップレベル設定として正式化）。
  // デフォルト順に `.ts` / `.tsx` を含めることで、拡張子省略時の解決を webpack と揃える。
  // 明示 `.js` 拡張子付き import の解決は Turbopack 側で未対応のため、上記 JSDoc 参照。
  turbopack: {
    resolveExtensions: [".mdx", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs", ".json"],
  },
  // packages/shared など workspace 内の .ts ファイルを .js 拡張子のインポート経由で解決する。
  // TypeScript の Bundler モードと整合させ、webpack でも同じ拡張子推論を行う。
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
