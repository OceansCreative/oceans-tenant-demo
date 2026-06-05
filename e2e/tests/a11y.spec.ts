import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * 主要 4 ページの WCAG 2.1 AA レベル axe 違反を 0 件に保つ E2E。
 *
 * - 検査対象タグ: wcag2a / wcag2aa / wcag21a / wcag21aa / best-practice
 * - 失敗時はページごとに violation のサマリを stderr に出して原因を追跡しやすくする
 * - Google Maps の埋め込みは API キー未設定の fallback UI を対象にしているため、
 *   外部スクリプト側の違反を踏まないように DOM はそのままチェックする
 */
const A11Y_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] as const;

const runAxe = async (page: import("@playwright/test").Page, label: string) => {
  const results = await new AxeBuilder({ page })
    .withTags([...A11Y_TAGS])
    // Studio ルートは Sanity 製の埋め込みのため除外。検査対象を OceansTenant 表面に絞る。
    .exclude("iframe")
    .analyze();
  if (results.violations.length > 0) {
    // 失敗時に詳細を残す（id / impact / help / nodes 数）。
    console.error(
      `[a11y:${label}] violations:`,
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      })),
    );
  }
  expect(results.violations, `${label} の axe 違反は 0 件でなければならない`).toEqual([]);
};

test.describe("a11y: 主要ページに axe-core 違反が無い", () => {
  test("/ (ランディング)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await runAxe(page, "/");
  });

  test("/search (検索)", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { level: 1, name: "物件を探す" })).toBeVisible();
    await runAxe(page, "/search");
  });

  test("/chat (対話検索)", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByRole("heading", { level: 1, name: "対話で物件を探す" })).toBeVisible();
    await runAxe(page, "/chat");
  });

  test("/properties/[slug] (物件詳細)", async ({ page }) => {
    await page.goto("/properties/sample-shinjuku-sanchome-street");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await runAxe(page, "/properties/[slug]");
  });

  test("/insights (物件統計ダッシュボード)", async ({ page }) => {
    await page.goto("/insights");
    await expect(page.getByRole("heading", { level: 1, name: "物件データ可視化" })).toBeVisible();
    await runAxe(page, "/insights");
  });

  test("/admin (物件管理 / feature flag 有効時)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "物件管理" })).toBeVisible();
    await runAxe(page, "/admin");
  });

  test("/admin/properties/new (物件新規作成)", async ({ page }) => {
    await page.goto("/admin/properties/new");
    await expect(page.getByRole("heading", { level: 1, name: "物件を新規作成" })).toBeVisible();
    await runAxe(page, "/admin/properties/new");
  });
});
