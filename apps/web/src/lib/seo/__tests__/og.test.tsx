import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/seo/og.tsx` の単体テスト。
 *
 * 設計戦略:
 * - `next/og` の `ImageResponse` は edge runtime 専用 / WASM 依存があるため、
 *   `vi.mock` で完全に差し替え、コンストラクタ引数（JSX + options）を捕捉する。
 * - フォント取得は `global.fetch` をモックして「成功」「CSS 404」「フォント本体 404」
 *   「ネットワーク例外」「regex 非マッチ」の各分岐を網羅する。
 * - JSX 内のテキストは React 要素ツリーを再帰探索して検証する（RTL は edge runtime
 *   表面の検証には不要 / props 構造直接検査で十分）。
 */

// ImageResponse コンストラクタへの呼び出しを観測するためのスパイ
const imageResponseSpy = vi.fn();

// ImageResponse はモック化（実物は edge runtime / WASM 依存で jsdom では動かない）
vi.mock("next/og", () => {
  class MockImageResponse {
    public readonly jsx: ReactElement;
    public readonly options: unknown;
    public readonly _isMock = true;
    constructor(jsx: ReactElement, options: unknown) {
      this.jsx = jsx;
      this.options = options;
      imageResponseSpy(jsx, options);
    }
  }
  return { ImageResponse: MockImageResponse };
});

/**
 * React 要素ツリーから文字列ノードを収集するヘルパー。
 *
 * - string / number はそのまま回収
 * - 配列は flatMap で展開
 * - host 要素 (`type` が string) は props.children を辿る
 * - 関数コンポーネントは `type(props)` を実行し、戻り値を再帰探索
 *   （og.tsx 内の `OgLayout` のように slots を渡してから本文を描画するため）
 */
const collectTextNodes = (node: unknown): Array<string> => {
  if (typeof node === "string") return [node];
  if (typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectTextNodes);
  if (node && typeof node === "object" && "props" in node) {
    const el = node as {
      type?: unknown;
      props?: { children?: unknown } & Record<string, unknown>;
    };
    const props = el.props ?? {};
    if (typeof el.type === "function") {
      const rendered = (el.type as (p: typeof props) => unknown)(props);
      return collectTextNodes(rendered);
    }
    return collectTextNodes(props.children);
  }
  return [];
};

const findAllTextContent = (jsx: ReactElement): string => collectTextNodes(jsx).join(" ");

/**
 * Response Body は一度しか read できないため、`buildFetchMock` は
 * factory（`() => Response`）を受け取り、各呼び出し毎に新しいインスタンスを返す。
 */
type FetchOutcome = (() => Response) | Error;

const cssOk = (): Response =>
  new Response(
    `@font-face { src: url(https://fonts.gstatic.com/s/notosansjp/v1/file.woff2) format('woff2'); }`,
    { status: 200 },
  );

const cssNoUrl = (): Response => new Response("/* no url here */", { status: 200 });

const cssNotFound = (): Response => new Response("not found", { status: 404 });

const fontOk = (): Response => new Response(new ArrayBuffer(8), { status: 200 });

const fontNotFound = (): Response => new Response("404", { status: 404 });

const buildFetchMock = (cssRes: FetchOutcome, fontRes?: FetchOutcome) => {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("fonts.googleapis.com")) {
      if (cssRes instanceof Error) throw cssRes;
      return cssRes();
    }
    if (fontRes === undefined) throw new Error(`想定外の fetch: ${url}`);
    if (fontRes instanceof Error) throw fontRes;
    return fontRes();
  });
};

const originalFetch = global.fetch;

beforeEach(() => {
  imageResponseSpy.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("renderOgImage: 正常系（フォント取得成功）", () => {
  it("ImageResponse を返し、props に title / eyebrow / meta が含まれる", async () => {
    global.fetch = buildFetchMock(cssOk, fontOk);
    const { renderOgImage } = await import("@/lib/seo/og");
    const result = await renderOgImage({
      eyebrow: "店舗物件",
      title: "サンプル物件タイトル",
      meta: "月額 10 万円 / 東京都",
    });
    expect(result).toBeDefined();
    expect((result as unknown as { _isMock: boolean })._isMock).toBe(true);
    expect(imageResponseSpy).toHaveBeenCalledTimes(1);
    const [jsx, options] = imageResponseSpy.mock.calls[0] ?? [];
    const flat = findAllTextContent(jsx);
    expect(flat).toContain("OceansTenant");
    expect(flat).toContain("店舗物件");
    expect(flat).toContain("サンプル物件タイトル");
    expect(flat).toContain("月額 10 万円 / 東京都");
    expect(options).toMatchObject({ width: 1200, height: 630 });
    // フォントが解決できているはず（regular + bold の 2 件）
    const fonts = (options as { fonts?: Array<unknown> }).fonts;
    expect(fonts).toBeDefined();
    expect(fonts).toHaveLength(2);
  });

  it("meta 省略時はフッターの段落をレンダリングしない", async () => {
    global.fetch = buildFetchMock(cssOk, fontOk);
    const { renderOgImage } = await import("@/lib/seo/og");
    await renderOgImage({ eyebrow: "検索", title: "検索結果サマリ" });
    const [jsx] = imageResponseSpy.mock.calls[0] ?? [];
    const flat = findAllTextContent(jsx);
    expect(flat).toContain("検索結果サマリ");
    // meta が無いので、ここには出ない（明確に false を期待）
    expect(flat).not.toContain("月額");
  });
});

describe("renderOgImage: フォント取得失敗時の fallback", () => {
  it("CSS が 404 のときシステムフォントで描画（fonts オプション省略）", async () => {
    global.fetch = buildFetchMock(cssNotFound);
    const { renderOgImage } = await import("@/lib/seo/og");
    await renderOgImage({ eyebrow: "x", title: "y" });
    const [, options] = imageResponseSpy.mock.calls[0] ?? [];
    expect(options).toMatchObject({ width: 1200, height: 630 });
    expect((options as { fonts?: unknown }).fonts).toBeUndefined();
  });

  it("CSS は OK だがフォント本体が 404 のとき fonts オプション省略", async () => {
    global.fetch = buildFetchMock(cssOk, fontNotFound);
    const { renderOgImage } = await import("@/lib/seo/og");
    await renderOgImage({ eyebrow: "x", title: "y" });
    const [, options] = imageResponseSpy.mock.calls[0] ?? [];
    expect((options as { fonts?: unknown }).fonts).toBeUndefined();
  });

  it("CSS の src URL が regex マッチしないと fallback", async () => {
    // url(...) が無いダミーレスポンス
    global.fetch = buildFetchMock(cssNoUrl);
    const { renderOgImage } = await import("@/lib/seo/og");
    await renderOgImage({ eyebrow: "x", title: "y" });
    const [, options] = imageResponseSpy.mock.calls[0] ?? [];
    expect((options as { fonts?: unknown }).fonts).toBeUndefined();
  });

  it("fetch が例外を投げても 500 にせず ImageResponse を返す", async () => {
    global.fetch = buildFetchMock(new Error("network down"));
    const { renderOgImage } = await import("@/lib/seo/og");
    const result = await renderOgImage({ eyebrow: "x", title: "y" });
    expect((result as unknown as { _isMock: boolean })._isMock).toBe(true);
    const [, options] = imageResponseSpy.mock.calls[0] ?? [];
    expect((options as { fonts?: unknown }).fonts).toBeUndefined();
  });
});

describe("renderOgImage: 長文タイトルとエッジケース", () => {
  it("長文タイトルでも例外を投げず描画される（CSS line-clamp 任せ）", async () => {
    global.fetch = buildFetchMock(cssNotFound);
    const { renderOgImage } = await import("@/lib/seo/og");
    const long = "極めて長い物件タイトル。".repeat(20);
    await renderOgImage({ eyebrow: "店舗物件", title: long });
    const [jsx] = imageResponseSpy.mock.calls[0] ?? [];
    expect(findAllTextContent(jsx)).toContain(long);
  });

  it("eyebrow / title / meta が空文字でもエラーにせずレンダリングできる", async () => {
    global.fetch = buildFetchMock(cssNotFound);
    const { renderOgImage } = await import("@/lib/seo/og");
    await renderOgImage({ eyebrow: "", title: "", meta: "" });
    expect(imageResponseSpy).toHaveBeenCalledTimes(1);
    const [, options] = imageResponseSpy.mock.calls[0] ?? [];
    expect(options).toMatchObject({ width: 1200, height: 630 });
  });
});

describe("OG_DIMENSIONS", () => {
  it("1200 x 630 を export する", async () => {
    const { OG_DIMENSIONS } = await import("@/lib/seo/og");
    expect(OG_DIMENSIONS).toEqual({ width: 1200, height: 630 });
  });
});
