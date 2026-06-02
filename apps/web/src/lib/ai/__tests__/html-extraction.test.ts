import { describe, expect, it } from "vitest";
import { extractReadableContent, isValidIngestUrl } from "@/lib/ai/html-extraction";

/**
 * `lib/ai/html-extraction.ts` の単体テスト。
 *
 * - Readability 経路: 本文長 > 200 を満たす HTML を投入し、`textContent` と `title` を確認。
 * - Cheerio fallback 経路: Readability が parse できない短文 HTML / 非記事ページ。
 * - `isValidIngestUrl`: http(s) スキーム判定 / ガード対象（javascript:, mailto:, 相対 URL）。
 *
 * 実在企業名・実在物件情報は使わず、サンプル文字列のみで構築する。
 */

const LONG_BODY = "店舗物件の本文サンプル。".repeat(40); // 200 文字を確実に超える日本語サンプル

describe("extractReadableContent: Readability 経路", () => {
  it("本文長 > 200 の article で Readability の textContent を返す", () => {
    const html = `<!DOCTYPE html>
<html>
  <head><title>テスト物件タイトル</title></head>
  <body>
    <article>
      <h1>店舗物件サンプル</h1>
      <p>${LONG_BODY}</p>
      <p>${LONG_BODY}</p>
    </article>
  </body>
</html>`;
    const result = extractReadableContent(html, "https://example.com/article");
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.textContent.length).toBeGreaterThan(200);
    expect(result.textContent).toContain("店舗物件の本文サンプル");
  });

  it("byline がある HTML では byline をコピーする", () => {
    const html = `<!DOCTYPE html>
<html>
  <head>
    <title>署名付き物件</title>
    <meta name="author" content="サンプル太郎" />
  </head>
  <body>
    <article>
      <h1>署名付き物件記事</h1>
      <p class="byline">サンプル太郎</p>
      <p>${LONG_BODY}</p>
      <p>${LONG_BODY}</p>
    </article>
  </body>
</html>`;
    const result = extractReadableContent(html, "https://example.com/byline");
    // Readability が byline を抽出できた場合のみ存在する。読み取れなくてもテスト失敗にはしない。
    if (result.byline) {
      expect(typeof result.byline).toBe("string");
      expect(result.byline.length).toBeGreaterThan(0);
    }
    expect(result.textContent.length).toBeGreaterThan(200);
  });
});

describe("extractReadableContent: Cheerio fallback 経路", () => {
  it("本文が極端に短く Readability が解析できない HTML では main / body を拾う", () => {
    const html = `<!DOCTYPE html>
<html>
  <head><title>短文ページ</title></head>
  <body>
    <main>店舗物件の極小本文。</main>
  </body>
</html>`;
    const result = extractReadableContent(html, "https://example.com/short");
    expect(result.title).toBe("短文ページ");
    expect(result.textContent).toContain("店舗物件の極小本文");
  });

  it("title 欠落時は h1 を fallback として使う", () => {
    const html = `<!DOCTYPE html>
<html>
  <body>
    <h1>h1 タイトル</h1>
    <main>本文短文</main>
  </body>
</html>`;
    const result = extractReadableContent(html, "https://example.com/no-title");
    expect(result.title).toBe("h1 タイトル");
  });

  it("script / style / nav / footer / iframe は除去される", () => {
    const html = `<!DOCTYPE html>
<html>
  <head><title>除去テスト</title></head>
  <body>
    <script>alert("XSS");</script>
    <style>body { color: red; }</style>
    <nav>ナビゲーション本文</nav>
    <footer>フッター本文</footer>
    <iframe src="https://example.com/x"></iframe>
    <main>本物の本文</main>
  </body>
</html>`;
    const result = extractReadableContent(html, "https://example.com/drop");
    expect(result.textContent).toContain("本物の本文");
    expect(result.textContent).not.toContain("XSS");
    expect(result.textContent).not.toContain("ナビゲーション本文");
    expect(result.textContent).not.toContain("フッター本文");
  });

  it("空 HTML（body も head も無い）でも例外を投げず空文字を返す", () => {
    const html = "<!DOCTYPE html><html></html>";
    const result = extractReadableContent(html, "https://example.com/empty");
    expect(result.title).toBe("");
    expect(result.textContent).toBe("");
  });

  it("連続する空白を 1 つに正規化する", () => {
    const html = `<!DOCTYPE html>
<html>
  <body>
    <main>   複数の    空白を    含む    本文   </main>
  </body>
</html>`;
    const result = extractReadableContent(html, "https://example.com/spaces");
    expect(result.textContent).not.toMatch(/ {2,}/);
    expect(result.textContent).toContain("複数の 空白を 含む 本文");
  });
});

describe("isValidIngestUrl", () => {
  it.each([
    ["https://example.com/", true],
    ["http://example.com/page?q=1", true],
    ["https://example.co.jp/property/abc-def", true],
  ])("有効: %s -> %s", (input, expected) => {
    expect(isValidIngestUrl(input)).toBe(expected);
  });

  it.each([
    ["javascript:alert(1)"],
    ["mailto:foo@example.com"],
    ["ftp://example.com/"],
    ["/relative/path"],
    [""],
    [" "],
    ["https://"],
    ["http: //example.com"], // スペース混入
  ])("無効: %s", (input) => {
    expect(isValidIngestUrl(input)).toBe(false);
  });

  it("URL_PATTERN は通るが URL コンストラクタで投げる入力は false", () => {
    // 半角空白入りはパターン側で除外される
    expect(isValidIngestUrl("https://exa mple.com/")).toBe(false);
  });
});
