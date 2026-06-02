/**
 * Storybook 用の `next/navigation` モック。
 *
 * `@storybook/react-vite` を採用したため `@storybook/nextjs` のネイティブモックは
 * 利用できない。Story 側で `useRouter` / `useSearchParams` / `usePathname` を呼ぶ
 * コンポーネント（SearchBar / SearchFilter / ViewModeToggle / ChatPanel）を破綻なく
 * 表示できる最小限のスタブを提供する。
 *
 * router の各メソッドは `console.info` でログを残すだけの no-op にする。
 * Storybook の Actions パネル経由で監視したくなったら `@storybook/test` の
 * `fn()` に差し替える方針。
 */

type RouterStub = {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (href: string) => void;
};

const ROUTER_STUB: RouterStub = {
  push: (href) => {
    console.info("[storybook mock] router.push", href);
  },
  replace: (href) => {
    console.info("[storybook mock] router.replace", href);
  },
  back: () => {
    console.info("[storybook mock] router.back");
  },
  forward: () => {
    console.info("[storybook mock] router.forward");
  },
  refresh: () => {
    console.info("[storybook mock] router.refresh");
  },
  prefetch: (href) => {
    console.info("[storybook mock] router.prefetch", href);
  },
};

export const useRouter = (): RouterStub => ROUTER_STUB;

/**
 * Story 側で `window.history.replaceState` を使ってクエリ文字列を差し込めるよう、
 * `URLSearchParams` は `window.location.search` を読みに行く実装にする。
 * クエリが未設定なら従来通り空の `URLSearchParams` と等価な値を返すため、
 * 既存 Story の挙動には影響しない（FilterChips など URL 状態に依存するコンポーネント向け）。
 */
export const useSearchParams = (): URLSearchParams => {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
};

export const usePathname = (): string =>
  typeof window === "undefined" ? "/" : window.location.pathname;

export const useParams = <T extends Record<string, string | string[]> = Record<string, string>>():
  | T
  | Record<string, never> => ({}) as Record<string, never>;

export const redirect = (url: string): never => {
  throw new Error(`[storybook mock] redirect to ${url}`);
};

export const notFound = (): never => {
  throw new Error("[storybook mock] notFound()");
};
