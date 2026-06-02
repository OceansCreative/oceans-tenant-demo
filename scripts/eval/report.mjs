/**
 * @file 評価結果を Markdown レポート / JSON に整形する。
 */

/**
 * @typedef {import("./metrics.mjs").FixtureResult} FixtureResult
 * @typedef {import("./metrics.mjs").AggregateMetrics} AggregateMetrics
 */

/**
 * @param {number} v
 * @returns {string}
 */
const fmt = (v) => `${(v * 100).toFixed(1)}%`;

/**
 * 比較対象フィールドの並び順を固定。レポートが安定し、CI 差分が読みやすくなる。
 */
const REPORT_FIELDS = [
  "title",
  "address.prefecture",
  "address.city",
  "rent",
  "area",
  "buildingType",
  "condition",
  "nearestStations",
  "suitableBusinessRefs",
  "features",
  "description",
  "floor",
];

/**
 * @param {ReadonlyArray<FixtureResult>} results
 * @param {AggregateMetrics} aggregate
 * @returns {string}
 */
export const renderMarkdownReport = (results, aggregate) => {
  const lines = [];
  lines.push("# extract_property 抽出評価レポート");
  lines.push("");
  lines.push("## サマリ");
  lines.push("");
  lines.push("| 指標 | 値 |");
  lines.push("|---|---:|");
  lines.push(`| 全体スコア（重み付き平均） | ${fmt(aggregate.overallScore)} |`);
  lines.push(`| Precision | ${fmt(aggregate.precision)} |`);
  lines.push(`| Recall | ${fmt(aggregate.recall)} |`);
  lines.push(`| F1 | ${fmt(aggregate.f1)} |`);
  lines.push(`| Fixture 件数 | ${results.length} |`);
  lines.push("");

  lines.push("## Fixture 別スコア");
  lines.push("");
  const header = ["fixture", ...REPORT_FIELDS, "overall"];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${header.map(() => "---").join(" | ")} |`);
  for (const r of results) {
    const cells = [r.fixtureId];
    for (const field of REPORT_FIELDS) {
      const f = r.fields.find((x) => x.field === field);
      cells.push(f ? fmt(f.score) : "-");
    }
    cells.push(fmt(r.overallScore));
    lines.push(`| ${cells.join(" | ")} |`);
  }
  lines.push("");

  lines.push("## フィールド別マッチ率");
  lines.push("");
  lines.push("| フィールド | 平均スコア | 厳密一致率 |");
  lines.push("|---|---:|---:|");
  for (const field of REPORT_FIELDS) {
    const slot = aggregate.perField[field];
    if (!slot) continue;
    const avg = slot.score / slot.total;
    const match = slot.matched / slot.total;
    lines.push(`| ${field} | ${fmt(avg)} | ${fmt(match)} |`);
  }
  lines.push("");

  // 失敗ケースの diff 表示
  const failureLines = [];
  for (const r of results) {
    const failed = r.fields.filter((f) => f.expectedPresent && !f.matched);
    if (failed.length === 0) continue;
    failureLines.push(`### ${r.fixtureId}`);
    failureLines.push("");
    for (const f of failed) {
      failureLines.push(
        `- **${f.field}** (score=${fmt(f.score)})`,
      );
      failureLines.push(`  - expected: \`${JSON.stringify(f.expected)}\``);
      failureLines.push(`  - actual:   \`${JSON.stringify(f.actual)}\``);
    }
    failureLines.push("");
  }
  if (failureLines.length > 0) {
    lines.push("## 失敗フィールドの diff");
    lines.push("");
    lines.push(...failureLines);
  }

  return lines.join("\n");
};

/**
 * CI 連携用の JSON 形式。スキーマは GitHub Actions ステップで使いやすいフラット構造。
 *
 * @param {ReadonlyArray<FixtureResult>} results
 * @param {AggregateMetrics} aggregate
 * @returns {object}
 */
export const renderJsonReport = (results, aggregate) => ({
  generatedAt: new Date().toISOString(),
  fixtures: results.map((r) => ({
    fixtureId: r.fixtureId,
    overallScore: r.overallScore,
    fields: r.fields.map((f) => ({
      field: f.field,
      score: f.score,
      matched: f.matched,
      expectedPresent: f.expectedPresent,
      actualPresent: f.actualPresent,
    })),
  })),
  aggregate: {
    precision: aggregate.precision,
    recall: aggregate.recall,
    f1: aggregate.f1,
    overallScore: aggregate.overallScore,
    perField: aggregate.perField,
  },
});
