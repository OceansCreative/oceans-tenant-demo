#!/usr/bin/env node
/**
 * @file eval JSON レポートを PR コメント用の Markdown に変換する。
 *
 * 使い方:
 *   node scripts/eval/ci-comment.mjs <eval-result.json> > comment.md
 *
 * 環境変数（任意 / GitHub Actions から渡されることを想定）:
 *   - PR_NUMBER         PR 番号（ヘッダ表示用、未設定ならヘッダから省略）
 *   - GITHUB_RUN_ID     ワークフロー実行 ID（Actions ログへのリンクに使用）
 *   - GITHUB_SERVER_URL `https://github.com`
 *   - GITHUB_REPOSITORY `owner/repo`
 *   - EVAL_MODE         `real` or `mock`（既定: real）
 *   - EVAL_COST_USD     推定コスト（数値文字列、例: `0.05`）
 *
 * 終了コード:
 *   0: Markdown 出力に成功
 *   1: 引数不足 / JSON 解析失敗
 *
 * 設計メモ:
 * - 失敗フィールド diff は **本コメントには載せない**（長くなりすぎる）。詳細は run.mjs の
 *   標準出力（Actions ログ）で確認できる。
 * - 「全体スコア < 0.6 で CI を落とす」判定は本スクリプトでは行わず、ワークフロー側で
 *   別 step を切る（責務分離）。
 */
import { readFile } from "node:fs/promises";

/**
 * @typedef {Object} EvalJsonReport
 * @property {string} generatedAt
 * @property {Array<{
 *   fixtureId: string;
 *   overallScore: number;
 *   fields: Array<{
 *     field: string;
 *     score: number;
 *     matched: boolean;
 *     expectedPresent: boolean;
 *     actualPresent: boolean;
 *   }>;
 * }>} fixtures
 * @property {{
 *   precision: number;
 *   recall: number;
 *   f1: number;
 *   overallScore: number;
 *   perField: Record<string, { score: number; matched: number; total: number }>;
 * }} aggregate
 */

/**
 * @param {number} v
 * @returns {string}
 */
const pct = (v) => `${(v * 100).toFixed(1)}%`;

/**
 * @param {EvalJsonReport} report
 * @returns {string}
 */
export const renderPrComment = (report) => {
  const prNumber = process.env.PR_NUMBER ?? "";
  const mode = process.env.EVAL_MODE === "mock" ? "mock" : "real";
  const modelName = mode === "real" ? "Claude Sonnet 4.5" : "モック（API 未使用）";
  const costUsd = process.env.EVAL_COST_USD ?? "";
  const runId = process.env.GITHUB_RUN_ID ?? "";
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  const runUrl = runId && repo ? `${serverUrl}/${repo}/actions/runs/${runId}` : "";

  const { aggregate, fixtures } = report;

  const headerSuffix = prNumber ? ` (#${prNumber})` : "";
  const lines = [];
  lines.push(`## extract_property 評価結果${headerSuffix}`);
  lines.push("");
  lines.push("| メトリクス | スコア |");
  lines.push("| --- | ---: |");
  lines.push(`| 全体スコア | ${pct(aggregate.overallScore)} |`);
  lines.push(`| Precision | ${pct(aggregate.precision)} |`);
  lines.push(`| Recall | ${pct(aggregate.recall)} |`);
  lines.push(`| F1 | ${pct(aggregate.f1)} |`);
  lines.push("");
  lines.push("### Fixture 別");
  lines.push("");
  lines.push("| Fixture | スコア |");
  lines.push("| --- | ---: |");
  for (const f of fixtures) {
    lines.push(`| ${f.fixtureId} | ${pct(f.overallScore)} |`);
  }
  lines.push("");
  lines.push(`実行モード: **${modelName}**`);
  if (costUsd) {
    lines.push("");
    lines.push(`推定コスト: \`$${costUsd}\``);
  }
  if (runUrl) {
    lines.push("");
    lines.push(`Actions ログ: ${runUrl}`);
  }
  lines.push("");
  lines.push(`<sub>generated at ${report.generatedAt}</sub>`);

  return lines.join("\n");
};

/**
 * @param {unknown} value
 * @returns {value is EvalJsonReport}
 */
const isEvalJsonReport = (value) => {
  if (typeof value !== "object" || value === null) return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  if (typeof v.generatedAt !== "string") return false;
  if (!Array.isArray(v.fixtures)) return false;
  if (typeof v.aggregate !== "object" || v.aggregate === null) return false;
  const agg = /** @type {Record<string, unknown>} */ (v.aggregate);
  for (const key of ["precision", "recall", "f1", "overallScore"]) {
    if (typeof agg[key] !== "number") return false;
  }
  return true;
};

const main = async () => {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      "使い方: node scripts/eval/ci-comment.mjs <eval-result.json> > comment.md",
    );
    process.exit(1);
  }
  const raw = await readFile(inputPath, "utf8");
  /** @type {unknown} */
  const parsed = JSON.parse(raw);
  if (!isEvalJsonReport(parsed)) {
    console.error("[ci-comment] eval JSON のスキーマが想定と異なります");
    process.exit(1);
  }
  const md = renderPrComment(parsed);
  process.stdout.write(`${md}\n`);
};

// テストからの import 時は main を起動しない
const invokedDirectly = process.argv[1]?.endsWith("ci-comment.mjs");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[ci-comment] 予期しないエラー:", err);
    process.exit(1);
  });
}
