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

// `URLSearchParams` を実体として返す。Story 側で `parameters.nextjs.navigation.query`
// を渡したい場合は preview.tsx 側の decorator で globals を介して上書きする想定。
export const useSearchParams = (): URLSearchParams => new URLSearchParams();

export const usePathname = (): string => "/";

export const useParams = <T extends Record<string, string | string[]> = Record<string, string>>():
  | T
  | Record<string, never> => ({}) as Record<string, never>;

export const redirect = (url: string): never => {
  throw new Error(`[storybook mock] redirect to ${url}`);
};

export const notFound = (): never => {
  throw new Error("[storybook mock] notFound()");
};
