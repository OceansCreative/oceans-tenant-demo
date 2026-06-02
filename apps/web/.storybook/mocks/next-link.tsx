import type { AnchorHTMLAttributes, ReactNode } from "react";

/**
 * Storybook 用の `next/link` モック。
 *
 * Next.js の `<Link>` のうち、UI 描画に効く props（`href` / `className` / `aria-*` / children）
 * のみを受け取り、ネイティブ `<a>` を描画する。クリック時のクライアントナビゲーション
 * （`router.push` 相当）は noop で十分（モック router 側で吸収）。
 */

type NextLinkMockProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  readonly href: string | { readonly pathname: string };
  readonly prefetch?: boolean;
  readonly replace?: boolean;
  readonly scroll?: boolean;
  readonly shallow?: boolean;
  readonly passHref?: boolean;
  readonly children?: ReactNode;
};

const NextLinkMock = ({
  href,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  passHref: _passHref,
  children,
  ...rest
}: NextLinkMockProps): React.JSX.Element => {
  const resolvedHref = typeof href === "string" ? href : href.pathname;
  return (
    <a href={resolvedHref} {...rest}>
      {children}
    </a>
  );
};

export default NextLinkMock;
