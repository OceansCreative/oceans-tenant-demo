// README に埋め込むスクリーンショットを撮影するスクリプト。
// 事前条件:
//   - apps/web が `pnpm --filter @oceans-tenant/web build` でビルド済み
//   - http://localhost:3000 で `next start` が起動中
//   - apps/web/node_modules/@playwright/test がインストール済み
//
// 出力:
//   - docs/images/desktop/{slug}.png (1440x900, fullPage)
//   - docs/images/mobile/{slug}.png  (iPhone 14, fullPage)
//
// 再現可能性のため:
//   - prefers-reduced-motion: reduce を強制し、アニメーションのブレを抑制
//   - ロード完了 + 0.5 秒の追加待機

import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename_resolve = fileURLToPath(import.meta.url);
// `apps/web` の node_modules を解決ベースにする
const requireFromWeb = createRequire(
  resolve(dirname(__filename_resolve), "../../apps/web/package.json"),
);
/** @type {typeof import("@playwright/test")} */
const { chromium, devices } = requireFromWeb("@playwright/test");
/** @type {typeof import("sharp")} */
const sharp = requireFromWeb("sharp");

const __dirname = dirname(__filename_resolve);
const ROOT = resolve(__dirname, "../..");
const OUT_DIR = resolve(ROOT, "docs/images");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/** 撮影対象ページ定義 */
const PAGES = [
  { slug: "landing", path: "/" },
  { slug: "search", path: "/search" },
  { slug: "property-detail", path: "/properties/sample-shinjuku-sanchome-street" },
  { slug: "chat", path: "/chat" },
  { slug: "agent", path: "/agent" },
  { slug: "agent-ingest", path: "/agent/ingest" },
];

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_DEVICE = devices["iPhone 14"];

/**
 * PNG を最適化（パレット化 + 圧縮）して上書き保存
 * @param {string} outPath
 * @param {{ maxWidth?: number }} [options]
 */
const optimizePng = async (outPath, options = {}) => {
  const { maxWidth } = options;
  const pipeline = sharp(outPath, { sequentialRead: true });
  if (maxWidth) {
    pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  const buf = await pipeline
    .png({ palette: true, quality: 80, compressionLevel: 9, effort: 10 })
    .toBuffer();
  await import("node:fs/promises").then((m) => m.writeFile(outPath, buf));
};

/**
 * 1 URL を撮影
 * @param {import("@playwright/test").BrowserContext} context
 * @param {string} url
 * @param {string} outPath
 * @param {{ maxWidth?: number }} [optimizeOptions]
 */
const capture = async (context, url, outPath, optimizeOptions) => {
  const page = await context.newPage();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // `networkidle` は SSE / Maps スクリプトの永続接続でタイムアウトしうるため `load` を使う
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    // フォント / 画像 / 遅延ハイドレーション分の追加待機
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: outPath, fullPage: true, type: "png" });
    await optimizePng(outPath, optimizeOptions);
    const { size } = await import("node:fs/promises").then((m) => m.stat(outPath));
    console.log(`[ok] ${url} -> ${outPath} (${Math.round(size / 1024)} KB)`);
  } catch (err) {
    console.error(`[fail] ${url}: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  } finally {
    await page.close();
  }
};

const main = async () => {
  await mkdir(resolve(OUT_DIR, "desktop"), { recursive: true });
  await mkdir(resolve(OUT_DIR, "mobile"), { recursive: true });

  const browser = await chromium.launch();
  try {
    // デスクトップ
    const desktopContext = await browser.newContext({
      viewport: DESKTOP_VIEWPORT,
      deviceScaleFactor: 1,
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
    });
    for (const target of PAGES) {
      const outPath = resolve(OUT_DIR, "desktop", `${target.slug}.png`);
      await capture(desktopContext, `${BASE_URL}${target.path}`, outPath, { maxWidth: 1440 });
    }
    await desktopContext.close();

    // モバイル
    const mobileContext = await browser.newContext({
      ...MOBILE_DEVICE,
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
    });
    for (const target of PAGES) {
      const outPath = resolve(OUT_DIR, "mobile", `${target.slug}.png`);
      // モバイルは Retina 2x で撮影されるため、幅 750 にダウンサンプル
      await capture(mobileContext, `${BASE_URL}${target.path}`, outPath, { maxWidth: 750 });
    }
    await mobileContext.close();
  } finally {
    await browser.close();
  }

  console.log("\n撮影完了。docs/images/{desktop,mobile}/*.png を確認してください。");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
