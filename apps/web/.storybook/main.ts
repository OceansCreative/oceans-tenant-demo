import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

/**
 * Storybook 8.6 + @storybook/react-vite (Vite 6 builder) 構成。
 *
 * 設計判断（builder 選定）:
 * - `@storybook/nextjs`（webpack5）は Next.js 15.5 が同梱する compiled webpack と
 *   builder-webpack5 が Cache.shutdown 経路で衝突する既知の不具合で落ちる。
 * - `@storybook/experimental-nextjs-vite` は内部依存の `vite-plugin-storybook-nextjs@1.1.5`
 *   が Next 14 までの内部 webpack プラグインパス（define-env-plugin.js）を直接 require
 *   しており Next 15.5 で解決できない。
 * - 結果として `@storybook/react-vite` を採用し、`next/navigation` / `next/link` /
 *   `next/font` は `viteFinal` のエイリアス + preview decorator で薄くモックする方針に統一。
 *   UI 単体可視化の用途には十分で、対話挙動（router.replace）は Story 上では noop。
 *
 * Tailwind v4 は公式 Vite プラグイン `@tailwindcss/vite` を使う（PostCSS 経路より高速）。
 *
 * addons:
 * - addon-essentials（docs / controls / actions / viewport / backgrounds / measure / outline）
 * - addon-a11y（axe-core ベースの a11y チェック。v0.6.0 で導入した a11y テストと方針を揃える）
 * - addon-interactions（CSF3 の `play()` を Storybook UI から実行可能に）
 *
 * stories は `src/components/**\/*.stories.tsx` を一括収集する。
 */
const config: StorybookConfig = {
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y", "@storybook/addon-interactions"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    // 型抽出は react-docgen に固定（react-docgen-typescript はモノレポでの型解決コストが大きい）。
    reactDocgen: "react-docgen",
  },
  docs: {
    autodocs: "tag",
  },
  async viteFinal(viteConfig) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          // `@/` パスエイリアス（apps/web/src/* を `@/*` で参照する Next.js 既定の設定）。
          "@": fileURLToPath(new URL("../src", import.meta.url)),
          // Next.js 固有モジュールを Storybook 用の薄いモックに差し替える。
          "next/navigation": fileURLToPath(new URL("./mocks/next-navigation.ts", import.meta.url)),
          "next/link": fileURLToPath(new URL("./mocks/next-link.tsx", import.meta.url)),
          "next/font/google": fileURLToPath(
            new URL("./mocks/next-font-google.ts", import.meta.url),
          ),
        },
      },
    });
  },
};

export default config;
