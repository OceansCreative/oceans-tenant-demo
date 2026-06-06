import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/admin` 配下の feature flag による分岐を検証する。
 *
 * - `NEXT_PUBLIC_ADMIN_ENABLED` 未設定 / 異なる値 → layout が `notFound()` を呼ぶ
 * - `"true"` のときのみ layout が children を描画する
 *
 * jsdom 環境では Next.js の `notFound()` は実例外を投げるため、`expect(...).toThrow()` で検証可能。
 * AdminNav は Client Component で next-intl の provider が必要だが、本テストでは
 * layout 関数の挙動だけを切り出すため AdminNav はモックする。
 */

vi.mock("@/components/admin/AdminNav", () => ({
  AdminNav: () => null,
}));

const originalEnv = process.env.NEXT_PUBLIC_ADMIN_ENABLED;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.NEXT_PUBLIC_ADMIN_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = originalEnv;
  }
});

describe("/admin layout の feature flag ガード", () => {
  it("NEXT_PUBLIC_ADMIN_ENABLED 未設定で notFound() が呼ばれる", async () => {
    delete process.env.NEXT_PUBLIC_ADMIN_ENABLED;
    const mod = await import("@/app/admin/layout");
    const Layout = mod.default;
    // notFound() は NEXT_NOT_FOUND を throw する
    await expect(Layout({ children: null })).rejects.toThrow();
  });

  it('NEXT_PUBLIC_ADMIN_ENABLED="true" 以外の値でも notFound() が呼ばれる', async () => {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = "1";
    const mod = await import("@/app/admin/layout");
    const Layout = mod.default;
    await expect(Layout({ children: null })).rejects.toThrow();
  });

  it('NEXT_PUBLIC_ADMIN_ENABLED="true" のときは children を返す', async () => {
    process.env.NEXT_PUBLIC_ADMIN_ENABLED = "true";
    const mod = await import("@/app/admin/layout");
    const Layout = mod.default;
    const ui = await Layout({ children: "child-content" });
    expect(ui).toBeTruthy();
  });
});
