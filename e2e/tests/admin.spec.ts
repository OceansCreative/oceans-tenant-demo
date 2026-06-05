import { expect, test } from "@playwright/test";

/**
 * Admin UI の主要動線を E2E で検証する。
 *
 * 前提:
 * - `playwright.config.ts` の `webServer.env` で `NEXT_PUBLIC_ADMIN_ENABLED=true` を渡している
 * - 物件データは mock store（初期状態は MOCK_PROPERTIES）から取り回している
 *
 * カバレッジ:
 * - `/admin` 一覧が表示される（feature flag 有効時のみ）
 * - 編集動線（一覧 → 詳細編集 → 保存 → 一覧へ戻る）
 * - 新規作成動線（フォーム入力 → 保存 → 一覧に新規物件が反映）
 */

test.describe("Admin UI 主要動線（feature flag 有効時）", () => {
  test("/admin に物件一覧が表示される", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "物件管理" })).toBeVisible();
    // mock store の初期データには「新宿三丁目 路面店（サンプル）」が含まれる
    await expect(page.getByText("新宿三丁目 路面店（サンプル）").first()).toBeVisible();
  });

  test("ヘッダーに「管理」リンクが表示される", async ({ page }) => {
    await page.goto("/");
    const adminLink = page.getByRole("link", { name: "管理" });
    await expect(adminLink).toBeVisible();
    await expect(adminLink).toHaveAttribute("href", "/admin");
  });

  test("一覧 → 編集ページ遷移 → タイトル変更 → 一覧に戻る", async ({ page }) => {
    await page.goto("/admin");
    // 編集リンクをクリック（最初の物件）
    await page.getByRole("link", { name: /編集/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /編集/ })).toBeVisible();

    // タイトルを編集
    const titleInput = page.getByLabel("物件名");
    await titleInput.fill("E2E 編集テスト物件");

    // 保存
    await page.getByRole("button", { name: "保存" }).click();

    // 一覧に戻り、編集後のタイトルが表示される
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("E2E 編集テスト物件").first()).toBeVisible();
  });

  test("新規作成フォームから物件を追加できる", async ({ page }) => {
    await page.goto("/admin/properties/new");
    await expect(page.getByRole("heading", { level: 1, name: "物件を新規作成" })).toBeVisible();

    const uniqueSlug = `e2e-new-${Date.now()}`;
    await page.getByLabel("物件名").fill("E2E 新規作成物件");
    await page.getByLabel("slug").fill(uniqueSlug);
    await page.getByLabel("市区町村").fill("千代田区");
    // 賃料・面積は初期値で submit
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("E2E 新規作成物件").first()).toBeVisible();
  });
});
