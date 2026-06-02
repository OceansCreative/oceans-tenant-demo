/**
 * @file ci-comment.mjs のユニットテスト。
 *
 * 実 I/O はせず、`renderPrComment` を直接呼んで Markdown 文字列の構造を検証する。
 * `pnpm --filter oceans-tenant-eval test` から `node --test` で起動される。
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { renderPrComment } from "../ci-comment.mjs";

/** @type {NodeJS.ProcessEnv} */
const originalEnv = { ...process.env };

const baseReport = Object.freeze({
  generatedAt: "2026-06-02T22:00:00.000Z",
  fixtures: [
    {
      fixtureId: "cafe-shibuya",
      overallScore: 0.95,
      fields: [],
    },
    {
      fixtureId: "bar-roppongi",
      overallScore: 0.82,
      fields: [],
    },
  ],
  aggregate: {
    precision: 0.91,
    recall: 0.88,
    f1: 0.894,
    overallScore: 0.885,
    perField: {},
  },
});

describe("renderPrComment", () => {
  beforeEach(() => {
    for (const key of [
      "PR_NUMBER",
      "EVAL_MODE",
      "EVAL_COST_USD",
      "GITHUB_RUN_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_SERVER_URL",
    ]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("基本的なメトリクス表と Fixture 表を含む", () => {
    const md = renderPrComment(baseReport);
    assert.match(md, /## extract_property 評価結果/);
    assert.match(md, /全体スコア \| 88\.5%/);
    assert.match(md, /Precision \| 91\.0%/);
    assert.match(md, /Recall \| 88\.0%/);
    assert.match(md, /F1 \| 89\.4%/);
    assert.match(md, /cafe-shibuya \| 95\.0%/);
    assert.match(md, /bar-roppongi \| 82\.0%/);
    assert.match(md, /generated at 2026-06-02T22:00:00\.000Z/);
  });

  it("PR_NUMBER がある時はヘッダに #N を付ける", () => {
    process.env.PR_NUMBER = "123";
    const md = renderPrComment(baseReport);
    assert.match(md, /## extract_property 評価結果 \(#123\)/);
  });

  it("EVAL_MODE=mock の時はモック表示になる", () => {
    process.env.EVAL_MODE = "mock";
    const md = renderPrComment(baseReport);
    assert.match(md, /実行モード: \*\*モック（API 未使用）\*\*/);
  });

  it("既定では実 Claude 表示", () => {
    const md = renderPrComment(baseReport);
    assert.match(md, /実行モード: \*\*Claude Sonnet 4\.5\*\*/);
  });

  it("EVAL_COST_USD が無い時はコスト行を出さない", () => {
    const md = renderPrComment(baseReport);
    assert.equal(md.includes("推定コスト"), false);
  });

  it("EVAL_COST_USD があるとコスト行を出す", () => {
    process.env.EVAL_COST_USD = "0.05";
    const md = renderPrComment(baseReport);
    assert.match(md, /推定コスト: `\$0\.05`/);
  });

  it("GITHUB_RUN_ID と GITHUB_REPOSITORY が揃うと Actions ログ URL を出す", () => {
    process.env.GITHUB_RUN_ID = "7890";
    process.env.GITHUB_REPOSITORY = "OceansCreative/oceans-tenant-demo";
    const md = renderPrComment(baseReport);
    assert.match(
      md,
      /Actions ログ: https:\/\/github\.com\/OceansCreative\/oceans-tenant-demo\/actions\/runs\/7890/,
    );
  });

  it("GITHUB_RUN_ID 単独では Actions ログ URL を出さない", () => {
    process.env.GITHUB_RUN_ID = "7890";
    const md = renderPrComment(baseReport);
    assert.equal(md.includes("Actions ログ"), false);
  });
});
