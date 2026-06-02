import type { Preview } from "@storybook/react";
// Tailwind v4 + brand トークン + Noto Sans JP CSS 変数のフォールバックを取り込む。
// `apps/web/src/styles/globals.css` 内の `@theme` / `@layer base` がそのまま preview に適用される。
import "../src/styles/globals.css";

/**
 * Storybook preview 設定。
 *
 * - グローバル CSS: Tailwind v4（globals.css 経由）
 * - パラメータ: 主要レイアウト幅の viewport / a11y デフォルト ON
 * - `next/font` の CSS 変数（`--font-noto-sans-jp`）は Storybook 内では注入されないため、
 *   `font-sans` が globals.css のフォールバック（system-ui）に解決される。表示崩れは起きない。
 *
 * `next/navigation` / `next/link` / `next/font/google` は `.storybook/main.ts` の
 * `viteFinal.resolve.alias` で薄いモックに差し替えている（`.storybook/mocks/` 配下）。
 */
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // axe の重大度を Storybook UI 上に集約。CI 側の axe テストとは独立で警告のみ。
      config: {
        rules: [],
      },
      options: {},
    },
    layout: "padded",
    backgrounds: {
      default: "white",
      values: [
        { name: "white", value: "#ffffff" },
        { name: "neutral-50", value: "#fafafa" },
        { name: "brand-100", value: "oklch(0.93 0.04 240)" },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: "モバイル (375)",
          styles: { width: "375px", height: "812px" },
        },
        tablet: {
          name: "タブレット (768)",
          styles: { width: "768px", height: "1024px" },
        },
        desktop: {
          name: "デスクトップ (1280)",
          styles: { width: "1280px", height: "800px" },
        },
      },
    },
  },
  tags: ["autodocs"],
};

export default preview;
