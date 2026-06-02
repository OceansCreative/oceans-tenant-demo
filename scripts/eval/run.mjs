#!/usr/bin/env node
/**
 * @file extract_property 評価ハーネスのエントリポイント。
 *
 * 使い方:
 *   node scripts/eval/run.mjs            # 実 Claude を呼ぶ（ANTHROPIC_API_KEY 必須）
 *   node scripts/eval/run.mjs --mock     # モック Claude（API キー不要、ハーネス動作確認用）
 *   node scripts/eval/run.mjs --output-json out.json  # JSON 形式で出力ファイルにも書き出す
 *
 * 終了コード:
 *   0: 全 fixture について抽出に成功（スコアは問わない）
 *   1: 何らかのエラー（fixtures 読込失敗 / Claude 呼び出し例外 等）
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { extractFromHtml, createRealAnthropicClient } from "./extract.mjs";
import { aggregateMetrics, scoreFixture } from "./metrics.mjs";
import { createMockAnthropicClient } from "./mock-anthropic.mjs";
import { renderJsonReport, renderMarkdownReport } from "./report.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

/**
 * @typedef {Object} CliOptions
 * @property {boolean} mock モック Claude を強制
 * @property {string | null} outputJson JSON 出力ファイルパス（null なら出力しない）
 */

/**
 * @param {ReadonlyArray<string>} argv
 * @returns {CliOptions}
 */
const parseArgs = (argv) => {
  /** @type {CliOptions} */
  const opts = { mock: false, outputJson: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--mock") opts.mock = true;
    else if (a === "--output-json") {
      const next = argv[i + 1];
      if (!next) throw new Error("--output-json には出力ファイルパスが必要です");
      opts.outputJson = next;
      i += 1;
    } else if (a === "--help" || a === "-h") {
      console.log("使い方: node scripts/eval/run.mjs [--mock] [--output-json <path>]");
      process.exit(0);
    }
  }
  return opts;
};

/**
 * fixtures ディレクトリから `(htmlPath, expectedJsonPath, id)` の組を収集する。
 *
 * @returns {Promise<Array<{ id: string; htmlPath: string; expectedPath: string }>>}
 */
const listFixtures = async () => {
  const entries = await readdir(FIXTURES_DIR);
  const htmls = entries.filter((e) => e.endsWith(".html")).sort();
  return htmls.map((html) => {
    const id = html.replace(/\.html$/, "");
    return {
      id,
      htmlPath: join(FIXTURES_DIR, html),
      expectedPath: join(FIXTURES_DIR, `${id}.expected.json`),
    };
  });
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));

  // クライアント選択: --mock or API キー未設定ならモック
  let client;
  let mode;
  if (opts.mock || !process.env.ANTHROPIC_API_KEY) {
    client = createMockAnthropicClient();
    mode = "mock";
    if (!opts.mock && !process.env.ANTHROPIC_API_KEY) {
      console.warn("[eval] ANTHROPIC_API_KEY 未設定のためモックモードで実行します。");
    }
  } else {
    const real = await createRealAnthropicClient();
    if (!real) {
      console.error("[eval] 実 Anthropic クライアントを初期化できませんでした。");
      process.exit(1);
    }
    client = real;
    mode = "real";
  }

  console.error(`[eval] mode=${mode}`);

  const fixtures = await listFixtures();
  if (fixtures.length === 0) {
    console.error("[eval] fixtures/ 配下に HTML が見つかりません");
    process.exit(1);
  }

  /** @type {Array<import("./metrics.mjs").FixtureResult>} */
  const results = [];

  for (const fx of fixtures) {
    const [html, expectedRaw] = await Promise.all([
      readFile(fx.htmlPath, "utf8"),
      readFile(fx.expectedPath, "utf8"),
    ]);
    const expected = JSON.parse(expectedRaw);
    const sourceUrl = `file://${fx.htmlPath}`;

    let actual = null;
    try {
      actual = await extractFromHtml({ client, sourceUrl, htmlText: html });
    } catch (err) {
      console.error(`[eval] ${fx.id} 抽出失敗:`, err instanceof Error ? err.message : err);
    }

    const result = scoreFixture(fx.id, expected, actual);
    results.push(result);
    console.error(
      `[eval] ${fx.id}: overall=${(result.overallScore * 100).toFixed(1)}%`,
    );
  }

  const aggregate = aggregateMetrics(results);
  const markdown = renderMarkdownReport(results, aggregate);
  process.stdout.write(`${markdown}\n`);

  if (opts.outputJson) {
    const json = renderJsonReport(results, aggregate);
    await writeFile(opts.outputJson, JSON.stringify(json, null, 2), "utf8");
    console.error(`[eval] JSON レポートを ${opts.outputJson} に書き出しました`);
  }
};

main().catch((err) => {
  console.error("[eval] 予期しないエラー:", err);
  process.exit(1);
});
