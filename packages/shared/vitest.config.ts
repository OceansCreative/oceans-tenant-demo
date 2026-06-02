import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      // text: CI ログで確認、json-summary: スクリプト連携、lcov: Codecov 連携
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts", "**/*.d.ts"],
      // 閾値は明示的に設定しない（warning レベル運用）。
      // shared は型 + Zod の純関数中心のため実数値は 99% 前後を維持しているが、
      // CI を fail させないポリシーで運用し、目標は docs/REVIEW_GUIDE.md に明示する。
    },
  },
});
