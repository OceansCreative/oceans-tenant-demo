import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      // text: CI ログで確認、json-summary: スクリプト連携、lcov: Codecov 連携
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        // テスト本体・テスト用ヘルパ
        "src/**/__tests__/**",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "**/*.d.ts",
        // Next.js App Router の Server Component 表面（薄いラッパが大半。ロジックは lib に寄せる方針）
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/og/**",
        "src/app/sitemap.ts",
        "src/app/robots.ts",
        // 純粋な定数や型のみのファイル
        "src/lib/site.ts",
      ],
      // 閾値は明示的に設定しない（warning レベル運用）。
      // 目標値は docs/REVIEW_GUIDE.md に記載し、Codecov の patch target で段階的に底上げする方針。
      // CI 失敗を強制したい場合は thresholds を vitest.config.ts に追加するか、`--coverage.thresholds.lines=70` を CLI 指定する。
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
