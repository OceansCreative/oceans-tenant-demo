/**
 * Storybook 用の `next/font/google` モック。
 *
 * `apps/web/src/app/layout.tsx` で `Noto_Sans_JP` を呼び CSS 変数を注入しているが、
 * Storybook 上では layout は使われないため、stories から間接 import された場合に
 * fallback で問題なく解決できるよう全フォント関数を no-op オブジェクトに差し替える。
 *
 * globals.css 側で `var(--font-noto-sans-jp), "Noto Sans JP", system-ui, ...` の
 * フォールバックが効くため、表示は system-ui に解決される。
 */

type FontReturn = {
  readonly className: string;
  readonly variable: string;
  readonly style: { readonly fontFamily: string };
};

const FONT_STUB: FontReturn = {
  className: "",
  variable: "",
  style: { fontFamily: "system-ui" },
};

// next/font/google が export しうる名前を一括で no-op 関数として提供する。
// 個別フォントごとに型は分かれているが、UI 側で参照されるのは上記 3 プロパティのみ。
const createFontStub = () => () => FONT_STUB;

export const Noto_Sans_JP = createFontStub();
export const Inter = createFontStub();
export const Roboto = createFontStub();

// `next/font/google` は default export を持たないが、念のため。
const handler: ProxyHandler<Record<string, () => FontReturn>> = {
  get: () => createFontStub(),
};

const proxy = new Proxy({} as Record<string, () => FontReturn>, handler);

export default proxy;
