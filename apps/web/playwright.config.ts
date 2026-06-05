import { defineConfig, devices } from "@playwright/test";

const PORT = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3000", 10);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// CI では build → start で動かす（dev の初回コンパイルでタイムアウトしないため）。
// ローカルではホットリロードを活かしたいので dev のまま。
const webServerCommand = process.env.CI
  ? `pnpm --filter @oceans-tenant/web exec next start --port ${PORT}`
  : `pnpm --filter @oceans-tenant/web exec next dev --port ${PORT}`;

export default defineConfig({
  testDir: "../../e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]]
    : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // i18n (v0.8.0+): middleware は Accept-Language で初期 locale を決定する。
    // Playwright の Chromium / WebKit はデフォルトで en-US を送るため、UI 文言を
    // 日本語前提で書かれたテストが落ちる。テスト全体で常に ja を強制する。
    // 個別テストで en を検証する場合は test.use({ locale: "en", extraHTTPHeaders: ... }) で上書きする。
    locale: "ja-JP",
    extraHTTPHeaders: {
      "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
    },
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    cwd: "../../",
    // v0.11.0 WS-1: admin E2E のために feature flag を有効化する。
    // `NEXT_PUBLIC_ADMIN_ENABLED=true` を Next.js のビルド時に埋め込み、
    // middleware の 404 rewrite を回避して `/admin` 配下を walking 可能にする。
    env: {
      ...process.env,
      NEXT_PUBLIC_ADMIN_ENABLED: "true",
    },
  },
});
