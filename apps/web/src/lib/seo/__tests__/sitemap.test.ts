/**
 * `app/sitemap.ts` / `app/robots.ts` のユニットテスト。
 *
 * - sitemap に静的 3 ページ + mock 物件 5 件が含まれること
 * - 各エントリが NEXT_PUBLIC_APP_URL 起点で正しく組まれること
 * - robots に sitemap URL が含まれ、`/studio` が disallow されていること
 * - 末尾スラッシュ付き / なし両方の APP_URL で URL が二重スラッシュにならないこと
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

const ENV_KEY = "NEXT_PUBLIC_APP_URL";

const importFresh = async () => {
  // app router の sitemap.ts / robots.ts は default export 関数を返す。
  vi.resetModules();
  const sitemapMod = await import("@/app/sitemap");
  const robotsMod = await import("@/app/robots");
  return {
    sitemap: sitemapMod.default,
    robots: robotsMod.default,
  };
};

describe("sitemap", () => {
  beforeEach(() => {
    vi.stubEnv(ENV_KEY, "https://example.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("静的 3 ページ + mock 物件全件を含む", async () => {
    const { sitemap } = await importFresh();
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://example.com/");
    expect(urls).toContain("https://example.com/search");
    expect(urls).toContain("https://example.com/chat");
    for (const property of MOCK_PROPERTIES) {
      expect(urls).toContain(`https://example.com/properties/${property.slug}`);
    }
    // 静的 3 + mock 件数
    expect(entries.length).toBe(3 + MOCK_PROPERTIES.length);
  });

  it("物件エントリは publishedAt を lastModified に採用する", async () => {
    const { sitemap } = await importFresh();
    const entries = sitemap();
    const first = MOCK_PROPERTIES[0];
    if (!first) throw new Error("mock データが空");
    const entry = entries.find((e) => e.url === `https://example.com/properties/${first.slug}`);
    expect(entry).toBeDefined();
    expect(entry?.lastModified).toBeInstanceOf(Date);
    expect((entry?.lastModified as Date).toISOString()).toBe(
      new Date(first.publishedAt).toISOString(),
    );
  });

  it("APP_URL の末尾スラッシュは正規化される", async () => {
    vi.stubEnv(ENV_KEY, "https://example.com/");
    const { sitemap } = await importFresh();
    const entries = sitemap();
    for (const entry of entries) {
      // `https://example.com//` のような二重スラッシュを許さない
      expect(entry.url).not.toMatch(/^https:\/\/example\.com\/\//);
    }
  });

  it("APP_URL 未設定時は localhost にフォールバックする", async () => {
    vi.stubEnv(ENV_KEY, "");
    const { sitemap } = await importFresh();
    const entries = sitemap();
    expect(entries[0]?.url.startsWith("http://localhost:3000")).toBe(true);
  });
});

describe("robots", () => {
  beforeEach(() => {
    vi.stubEnv(ENV_KEY, "https://example.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sitemap と allow / disallow ルールを含む", async () => {
    const { robots } = await importFresh();
    const result = robots();
    expect(result.sitemap).toBe("https://example.com/sitemap.xml");
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const first = rules[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.userAgent).toBe("*");
    expect(first.allow).toBe("/");
    const disallow = Array.isArray(first.disallow) ? first.disallow : [first.disallow];
    expect(disallow).toContain("/studio");
  });
});
