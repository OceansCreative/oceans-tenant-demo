"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { isAdminEnabled } from "@/lib/admin/feature-flag";
import { cn } from "@/lib/cn";
import { LocaleSwitcher } from "./LocaleSwitcher";

type HeaderProps = {
  readonly className?: string;
};

/**
 * 主要ナビゲーションの href と翻訳キーのペア定義。
 * v0.8.1 で `/properties` や `/agent/dashboard` を追加する余地を残し、
 * 文言は `messages/*.json` の `nav.*` 名前空間から引く。
 *
 * v0.11.0 (WS-1): admin が feature flag 有効時のみ末尾に追加される。
 * `NEXT_PUBLIC_*` 接頭辞なのでクライアント側でも参照可能。
 */
const BASE_NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/search", key: "search" },
  { href: "/chat", key: "chat" },
  { href: "/insights", key: "insights" },
  { href: "/agent", key: "agent" },
] as const;

const ADMIN_NAV_ITEM = { href: "/admin", key: "admin" } as const;

type NavItem = { readonly href: string; readonly key: string };

const buildNavItems = (): ReadonlyArray<NavItem> =>
  isAdminEnabled() ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] : [...BASE_NAV_ITEMS];

/**
 * グローバルヘッダー（Client Component）。
 *
 * v0.8.0 で next-intl 化。`useTranslations()` を使うため `"use client"` に切替え。
 * 双方向の DOM 操作は LocaleSwitcher のみで、Header 本体は静的なリンク列なので
 * クライアント化による hydration コストは低い（バンドル増は約 1KB 想定）。
 */
export const Header = ({ className }: HeaderProps): React.JSX.Element => {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const navItems = buildNavItems();
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/85 backdrop-blur",
        className,
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-neutral-900"
          aria-label={tNav("brandLabel")}
        >
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-white text-sm font-bold"
          >
            OT
          </span>
          <span className="text-lg tracking-wide">{tCommon("siteName")}</span>
        </Link>

        <nav aria-label={tNav("home")} className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm text-neutral-700">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition-colors hover:text-brand-600 focus-visible:text-brand-600"
                >
                  {tNav(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher className="hidden md:flex" />
          <Link
            href="/agent/ingest"
            className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 md:inline-flex"
          >
            {tNav("registerCta")}
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 md:hidden"
            aria-label={tCommon("openMenu")}
            aria-expanded="false"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
