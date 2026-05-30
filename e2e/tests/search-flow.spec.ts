import { expect, test } from "@playwright/test";

test.describe("検索フロー", () => {
  test("ランディング → 物件を探す CTA → /search 到達", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/OceansTenant/);

    const cta = page.getByRole("link", { name: "物件を探す" }).first();
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByRole("heading", { level: 1, name: "物件を探す" })).toBeVisible();
  });

  test("検索フィルタの都道府県を変えると件数が変化する", async ({ page }) => {
    await page.goto("/search");
    const beforeText = await page
      .getByText(/件 \/ 全 \d+ 件/)
      .first()
      .textContent();
    const prefSelect = page.getByLabel("都道府県");
    await prefSelect.selectOption("東京都");
    await expect(page.getByText(/件 \/ 全 \d+ 件/).first()).not.toHaveText(beforeText ?? "");
    await expect(page).toHaveURL(/prefecture=東京都|prefecture=%E6%9D%B1%E4%BA%AC%E9%83%BD/);
  });

  test("カードクリックで詳細ページに遷移する", async ({ page }) => {
    await page.goto("/search");
    const firstCard = page.getByTestId("property-card").first();
    await expect(firstCard).toBeVisible();
    const link = firstCard.getByRole("link").first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/properties\//);
    await link.click();
    await expect(page).toHaveURL(/\/properties\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "基本情報" })).toBeVisible();
  });

  test("条件クリアで全件に戻る", async ({ page }) => {
    await page.goto("/search?prefecture=東京都");
    await expect(page.getByText(/件 \/ 全 \d+ 件（フィルタ適用中）/)).toBeVisible();
    await page.getByRole("button", { name: "条件をクリア" }).click();
    await expect(page).toHaveURL(/\/search$/);
  });

  test("地図ビューに切り替えても遷移はクライアント遷移で完結", async ({ page }) => {
    await page.goto("/search");
    await page.getByRole("button", { name: /地図/ }).click();
    await expect(page).toHaveURL(/view=map/);
    // Google Maps API キーがないため、フォールバック UI が表示される
    await expect(page.getByText(/地図ビューは無効化されています|Google Maps/)).toBeVisible();
  });
});
