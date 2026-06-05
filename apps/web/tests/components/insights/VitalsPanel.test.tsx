/**
 * VitalsPanel の表示テスト。
 *
 * - 空配列: empty メッセージのみ表示し、テーブルは描画しない
 * - サンプルあり: メトリクスごとに median / p75 / sampleCount + rating ラベルが出る
 * - rating は値 → 閾値で機械的に決まるため境界値もカバー
 */

import { describe, expect, it } from "vitest";
import { VitalsPanel } from "@/components/insights/VitalsPanel";
import type { MetricSummary } from "@/lib/vitals/aggregate";
import { renderWithI18n, screen } from "../../test-utils";

const buildSummary = (overrides: Partial<MetricSummary> = {}): MetricSummary => ({
  metric: "LCP",
  path: "/",
  sampleCount: 10,
  median: 2000,
  p75: 2400,
  ...overrides,
});

describe("VitalsPanel", () => {
  it("空配列のときは empty メッセージを表示する", () => {
    renderWithI18n(<VitalsPanel summaries={[]} />);
    expect(screen.getByTestId("vitals-empty")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("サンプルがある時はテーブルを描画する", () => {
    renderWithI18n(
      <VitalsPanel
        summaries={[
          buildSummary({ metric: "LCP", path: "/", median: 1500, p75: 2000, sampleCount: 5 }),
          buildSummary({
            metric: "CLS",
            path: "/search",
            median: 0.05,
            p75: 0.08,
            sampleCount: 3,
          }),
        ]}
      />,
    );
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    // 行ヘッダ（メトリクス名）が表示されている
    expect(screen.getAllByText("LCP").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CLS")).toBeInTheDocument();
    // path 表示
    expect(screen.getByText("/search")).toBeInTheDocument();
    // 中央値: LCP は ms 表記、CLS は小数 3 桁
    expect(screen.getByText("1500 ms")).toBeInTheDocument();
    expect(screen.getByText("2000 ms")).toBeInTheDocument();
    expect(screen.getByText("0.050")).toBeInTheDocument();
    expect(screen.getByText("0.080")).toBeInTheDocument();
  });

  it("LCP の p75=2400 は良好評価ラベル（●）", () => {
    renderWithI18n(
      <VitalsPanel
        summaries={[buildSummary({ metric: "LCP", p75: 2400, median: 2000, sampleCount: 4 })]}
      />,
    );
    // i18n は ja 既定: 「良好」
    expect(screen.getByText("良好")).toBeInTheDocument();
  });

  it("LCP の p75=3500 は改善の余地（◐）", () => {
    renderWithI18n(
      <VitalsPanel
        summaries={[buildSummary({ metric: "LCP", p75: 3500, median: 2000, sampleCount: 4 })]}
      />,
    );
    expect(screen.getByText("改善の余地")).toBeInTheDocument();
  });

  it("LCP の p75=5000 は要改善（◯）", () => {
    renderWithI18n(
      <VitalsPanel
        summaries={[buildSummary({ metric: "LCP", p75: 5000, median: 3000, sampleCount: 4 })]}
      />,
    );
    expect(screen.getByText("要改善")).toBeInTheDocument();
  });

  it("rating ラベルには `aria-label` でメトリクスフルネーム入りの読み上げ文が付く", () => {
    renderWithI18n(
      <VitalsPanel
        summaries={[buildSummary({ metric: "LCP", p75: 2400, median: 2000, sampleCount: 4 })]}
      />,
    );
    const ratingLabel = screen.getByLabelText("Largest Contentful Paint は良好の範囲です");
    expect(ratingLabel).toBeInTheDocument();
  });

  it("英語ロケールでも見出し / 評価ラベルが切り替わる", () => {
    renderWithI18n(
      <VitalsPanel
        summaries={[
          buildSummary({ metric: "INP", path: "/", p75: 100, median: 80, sampleCount: 5 }),
        ]}
      />,
      { locale: "en" },
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Web Vitals (field measurements)",
    );
    expect(screen.getByText("Good")).toBeInTheDocument();
  });
});
