// README 埋め込み用の操作デモ GIF を撮影するスクリプト（v0.4.0 WS-3）。
//
// 概要:
//   - Playwright で UI を操作しながら、固定 FPS で PNG フレームを連続取得
//   - ffmpeg の palettegen / paletteuse パイプラインで圧縮率と画質を両立した GIF を生成
//
// 事前条件:
//   - apps/web を `pnpm --filter @oceans-tenant/web build` でビルド済み
//   - http://localhost:3000 で `next start` 起動中（このスクリプトは起動済みサーバーを再利用）
//
// 出力:
//   - docs/images/demos/search-filter.gif  : /search でのフィルタ変更による絞り込み
//   - docs/images/demos/ai-chat.gif        : /chat の自然言語入力 → Tool Use → SSE 結果配信
//   - docs/images/demos/url-ingest.gif     : /agent/ingest の URL 投入 → AI 抽出 → ドラフト整形
//
// 設計判断:
//   - ffmpeg は @ffmpeg-installer/ffmpeg のバンドルバイナリ（macOS / Linux で動作）
//   - 外部 API 鍵が必要な /api/chat-search・/api/ingest-url は Playwright `page.route` で
//     ダミー応答に差し替えるため、ANTHROPIC_API_KEY 等が無くても撮影できる
//   - フレームレート 15 fps / 解像度 1280x720 / 無限ループ
//   - パレットは `stats_mode=diff` + Bayer ディザでファイルサイズを抑制
//
// 使い方:
//   pnpm screenshots:gif
//   pnpm screenshots:gif -- --only=search-filter   # 1 本だけ撮り直したいとき

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, rm, stat, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename_resolve = fileURLToPath(import.meta.url);
const requireFromWeb = createRequire(
  resolve(dirname(__filename_resolve), "../../apps/web/package.json"),
);
/** @type {typeof import("@playwright/test")} */
const { chromium } = requireFromWeb("@playwright/test");

const __dirname = dirname(__filename_resolve);
const ROOT = resolve(__dirname, "../..");
const OUT_DIR = resolve(ROOT, "docs/images/demos");
const FRAMES_BASE = resolve(ROOT, ".cache/gif-frames");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// ffmpeg バイナリパスは @ffmpeg-installer/ffmpeg から解決（ルートで dev 依存として導入）
const requireFromRoot = createRequire(resolve(ROOT, "package.json"));
/** @type {{ path: string }} */
const ffmpegInstaller = requireFromRoot("@ffmpeg-installer/ffmpeg");
const FFMPEG_BIN = ffmpegInstaller.path;

const FPS = 15;
const VIEWPORT = { width: 1280, height: 720 };

/**
 * 引数 `--only=slug` をパースする。
 * @returns {string | null}
 */
const parseOnly = () => {
  const flag = process.argv.find((arg) => arg.startsWith("--only="));
  return flag ? flag.slice("--only=".length) : null;
};

/**
 * ffmpeg を子プロセスとして実行する。stderr は通常 ffmpeg のログなので最後だけ表示する。
 * @param {ReadonlyArray<string>} args
 * @returns {Promise<void>}
 */
const runFfmpeg = (args) =>
  new Promise((resolveFn, rejectFn) => {
    const child = spawn(FFMPEG_BIN, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectFn);
    child.on("close", (code) => {
      if (code === 0) resolveFn();
      else {
        rejectFn(new Error(`ffmpeg 終了コード ${code}\n${stderr.slice(-2000)}`));
      }
    });
  });

/**
 * PNG フレーム列 → 最適化 GIF を生成。
 *
 * palettegen で動画全体の代表色 256 色を抽出し、paletteuse + Bayer ディザで
 * 帯状ノイズを抑えつつファイルサイズを縮めるのが定石。
 *
 * @param {string} framesGlob   ffmpeg の入力パターン（例: frames/frame-%05d.png）
 * @param {string} outGif       出力 .gif フルパス
 */
const encodeGif = async (framesGlob, outGif) => {
  const paletteFile = `${outGif}.palette.png`;
  // 1. パレット生成
  await runFfmpeg([
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    framesGlob,
    "-vf",
    "fps=" + FPS + ",scale=" + VIEWPORT.width + ":-1:flags=lanczos,palettegen=stats_mode=diff",
    paletteFile,
  ]);
  // 2. パレット適用 + ループ無限
  await runFfmpeg([
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    framesGlob,
    "-i",
    paletteFile,
    "-filter_complex",
    "fps=" +
      FPS +
      ",scale=" +
      VIEWPORT.width +
      ":-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    "-loop",
    "0",
    outGif,
  ]);
  await rm(paletteFile, { force: true });
};

/**
 * ページから FPS 間隔で連続スクリーンショットを撮るレコーダーを返す。
 *
 * Playwright のスクリーンショットは 1 枚 50〜120ms 程度かかるため、厳密に 15 fps は
 * 出ない。フレーム取得が遅れた場合は実時間に近づけるため `t = await getNow()` を
 * 計測してファイル名に通し番号を振る方式とした（ffmpeg 側で `-framerate 15` を
 * 指定して再生時間を擬似的に合わせる）。
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} framesDir
 */
const createRecorder = async (page, framesDir) => {
  await mkdir(framesDir, { recursive: true });
  let counter = 0;
  let stopped = false;
  let intervalHandle = null;
  let inflight = Promise.resolve();

  const snap = async () => {
    const idx = counter++;
    const filename = resolve(framesDir, `frame-${String(idx).padStart(5, "0")}.png`);
    try {
      await page.screenshot({ path: filename, type: "png", animations: "allow" });
    } catch (err) {
      // ナビゲーション中などで失敗することがあるが、後続コマで埋めれば良い
      console.warn(`[gif] frame ${idx} skipped: ${err instanceof Error ? err.message : err}`);
    }
  };

  intervalHandle = setInterval(() => {
    if (stopped) return;
    inflight = inflight.then(snap);
  }, Math.floor(1000 / FPS));

  return {
    async stop() {
      stopped = true;
      if (intervalHandle) clearInterval(intervalHandle);
      await inflight;
    },
    framesPattern: resolve(framesDir, "frame-%05d.png"),
  };
};

/**
 * 検索フィルタの操作デモ。/search で都道府県・賃料・業種を順に切り替える。
 *
 * @param {import("@playwright/test").BrowserContext} ctx
 * @param {string} framesDir
 */
const recordSearchFilter = async (ctx, framesDir) => {
  const page = await ctx.newPage();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${BASE_URL}/search`, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });
    // 結果カードが出るまで待つ
    await page.waitForSelector("aside[aria-label='検索フィルタ']", { timeout: 15_000 });
    await page.waitForTimeout(400);

    const recorder = await createRecorder(page, framesDir);
    try {
      // mock データ 5 件のうち東京都は 3 件あり、絞り込み過程でカード数が
      // 視覚的に減っていく様子が見えるよう、結果が 1 件以上残る条件で組む。

      // 1. 都道府県を東京都に
      await page.selectOption("select[aria-label='都道府県']", "東京都");
      await page.waitForTimeout(700);

      // 2. 賃料上限 60 万円（東京 3 件中 港区 68 万を除外 → 残り 2 件）
      const maxRentInput = page.locator("input[aria-label='賃料上限']");
      await maxRentInput.fill("600000");
      await page.waitForTimeout(700);

      // 3. 建物形態「路面」をトグル（地下バー / 港区オフィスは非該当 → 1 件に）
      await page.locator("button:has-text('路面')").first().click();
      await page.waitForTimeout(900);

      // 4. クリア
      await page.locator("button:has-text('条件をクリア')").click();
      await page.waitForTimeout(700);
    } finally {
      await recorder.stop();
    }
    return recorder.framesPattern;
  } finally {
    await page.close();
  }
};

/**
 * /chat に Playwright `page.route` でモック SSE 応答を仕込み、Tool Use → 結果配信の様子を撮る。
 *
 * @param {import("@playwright/test").BrowserContext} ctx
 * @param {string} framesDir
 */
const recordAiChat = async (ctx, framesDir) => {
  const page = await ctx.newPage();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });

    // モック SSE：criteria → message → results → done を時間差で投げる
    await page.route("**/api/chat-search", async (route) => {
      const mockProperties = [
        {
          title: "新宿三丁目 路面店（サンプル）",
          slug: "sample-shinjuku-sanchome-street",
          address: {
            prefecture: "東京都",
            city: "新宿区",
            streetAddress: "新宿 3-1-1",
            geopoint: { lat: 35.6921, lng: 139.7035 },
          },
          nearestStations: [
            { line: "東京メトロ丸ノ内線", station: "新宿三丁目", walkMinutes: 1 },
          ],
          rent: 180000,
          commonFee: 12000,
          depositMonths: 6,
          keyMoneyMonths: 1,
          area: 28.5,
          floor: "1 階",
          buildingType: "street_level",
          condition: "skeleton",
          suitableBusinessRefs: ["category-cafe"],
          images: [],
          description: "明治通り沿いのコーナー立地。",
          features: ["スケルトン", "視認性高"],
          availability: "public",
          listedByRef: "company-001",
          aiMeta: { aiExtracted: false },
          publishedAt: "2026-05-01T00:00:00.000Z",
          tsubo: 8.62,
        },
        {
          title: "渋谷区 路面店（サンプル）",
          slug: "sample-shibuya-street",
          address: {
            prefecture: "東京都",
            city: "渋谷区",
            streetAddress: "宇田川町 2-1-1",
            geopoint: { lat: 35.6624, lng: 139.6986 },
          },
          nearestStations: [{ line: "JR 山手線", station: "渋谷", walkMinutes: 5 }],
          rent: 195000,
          commonFee: 14000,
          depositMonths: 6,
          keyMoneyMonths: 1,
          area: 26.0,
          floor: "1 階",
          buildingType: "street_level",
          condition: "second_hand",
          suitableBusinessRefs: ["category-cafe"],
          images: [],
          description: "渋谷駅徒歩 5 分の路面店舗。",
          features: ["居抜き", "視認性高"],
          availability: "public",
          listedByRef: "company-002",
          aiMeta: { aiExtracted: true, aiConfidence: 0.82 },
          publishedAt: "2026-04-10T00:00:00.000Z",
          tsubo: 7.86,
        },
      ];

      // SSE フォーマット data: ... \n\n
      const events = [
        { delay: 250, event: { type: "criteria", criteria: {
          prefecture: "東京都",
          city: undefined,
          minRent: undefined,
          maxRent: 200000,
          minArea: undefined,
          maxArea: undefined,
          buildingTypes: [],
          conditions: [],
          businessCategoryRefs: ["category-cafe"],
          page: 1,
        } } },
        { delay: 500, event: { type: "message", content: "東京都内・賃料 20 万円以下・カフェ向けで絞り込みました。" } },
        { delay: 700, event: { type: "results", properties: mockProperties } },
        { delay: 150, event: { type: "done" } },
      ];

      const body =
        events
          .map((e) => `data: ${JSON.stringify(e.event)}\n\n`)
          .join("");
      // 実際のストリーミングは page.route の制約上 1 ショットで返す（UI 側は即時更新で OK）
      await new Promise((r) => setTimeout(r, 250));
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body,
      });
    });

    await page.goto(`${BASE_URL}/chat`, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });
    await page.waitForSelector("input[aria-label='メッセージ']", { timeout: 15_000 });
    await page.waitForTimeout(400);

    const recorder = await createRecorder(page, framesDir);
    try {
      // 入力欄に自然文を 1 文字ずつ流し込む（タイピングアニメーション）
      const input = page.locator("input[aria-label='メッセージ']");
      await input.focus();
      const message = "東京の20万円以下のカフェ向け物件";
      await input.pressSequentially(message, { delay: 70 });
      await page.waitForTimeout(400);
      await page.locator("button[type='submit']").click();
      // 結果が反映されるまで待つ
      await page.waitForSelector("h2:has-text('ヒット物件 (2)')", { timeout: 5_000 }).catch(() => {
        // フォールバック: 単純に時間待ち
      });
      await page.waitForTimeout(1800);
    } finally {
      await recorder.stop();
    }
    return recorder.framesPattern;
  } finally {
    await page.close();
  }
};

/**
 * /agent/ingest にモック応答を仕込み、URL 投入 → AI 抽出 → カード表示までを撮る。
 *
 * @param {import("@playwright/test").BrowserContext} ctx
 * @param {string} framesDir
 */
const recordUrlIngest = async (ctx, framesDir) => {
  const page = await ctx.newPage();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.route("**/api/ingest-url", async (route) => {
      // AI 抽出に少し時間がかかっている感を出すために遅延
      await new Promise((r) => setTimeout(r, 1200));
      const draft = {
        title: "中央区銀座 1 階路面店（サンプル）",
        slug: "sample-chuoku-ginza-street",
        address: {
          prefecture: "東京都",
          city: "中央区",
          streetAddress: "銀座 4-2-1",
          geopoint: { lat: 35.6717, lng: 139.7649 },
        },
        nearestStations: [
          { line: "東京メトロ銀座線", station: "銀座", walkMinutes: 2 },
        ],
        rent: 850000,
        commonFee: 48000,
        depositMonths: 12,
        keyMoneyMonths: 2,
        area: 42.5,
        floor: "1 階",
        buildingType: "street_level",
        condition: "skeleton",
        suitableBusinessRefs: ["category-cafe", "category-restaurant"],
        images: [],
        description: "銀座中央通りから 1 本入った視認性の高い路面区画。",
        features: ["スケルトン", "天井高 3.2m", "視認性高"],
        availability: "public",
        listedByRef: "company-001",
        aiMeta: {
          aiExtracted: true,
          aiConfidence: 0.88,
          sourceUrl: "https://example.com/listings/ginza-sample",
        },
        publishedAt: "2026-06-01T00:00:00.000Z",
        tsubo: 12.85,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", draft, confidence: 0.88 }),
      });
    });

    await page.goto(`${BASE_URL}/agent/ingest`, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });
    await page.waitForSelector("input[type='url']", { timeout: 15_000 });
    await page.waitForTimeout(400);

    const recorder = await createRecorder(page, framesDir);
    try {
      const urlInput = page.locator("input[type='url']");
      await urlInput.focus();
      await urlInput.pressSequentially("https://example.com/listings/ginza-sample", { delay: 35 });
      await page.waitForTimeout(400);
      await page.locator("button[type='submit']").click();
      // 「AI で抽出中…」の状態を見せたい
      await page.waitForTimeout(1400);
      // 抽出完了
      await page
        .waitForSelector("text=AI 抽出信頼度", { timeout: 5_000 })
        .catch(() => undefined);
      await page.waitForTimeout(1600);
    } finally {
      await recorder.stop();
    }
    return recorder.framesPattern;
  } finally {
    await page.close();
  }
};

const SCENES = [
  { slug: "search-filter", record: recordSearchFilter },
  { slug: "ai-chat", record: recordAiChat },
  { slug: "url-ingest", record: recordUrlIngest },
];

const main = async () => {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(FRAMES_BASE, { recursive: true });

  const only = parseOnly();
  const targets = only ? SCENES.filter((s) => s.slug === only) : SCENES;
  if (only && targets.length === 0) {
    throw new Error(`--only=${only} に該当するシーンがありません`);
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
    });
    for (const scene of targets) {
      const framesDir = resolve(FRAMES_BASE, scene.slug);
      // クリーンに撮り直すため毎回フレームを消す
      await rm(framesDir, { recursive: true, force: true });
      console.log(`[gif] ${scene.slug} 撮影開始`);
      const framesPattern = await scene.record(context, framesDir);

      const frameCount = (await readdir(framesDir)).filter((f) => f.endsWith(".png")).length;
      console.log(`[gif] ${scene.slug} フレーム ${frameCount} 枚`);
      if (frameCount === 0) {
        throw new Error(`${scene.slug}: フレームが 1 枚も保存されていません`);
      }

      const outGif = resolve(OUT_DIR, `${scene.slug}.gif`);
      await encodeGif(framesPattern, outGif);
      const { size } = await stat(outGif);
      console.log(`[ok] ${outGif} (${(size / 1024 / 1024).toFixed(2)} MB / ${frameCount} frames)`);
    }
    await context.close();
  } finally {
    await browser.close();
  }

  console.log("\nGIF 撮影完了。docs/images/demos/*.gif を確認してください。");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
