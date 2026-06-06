"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Admin 配下の共通サブナビ。
 *
 * - layout.tsx から呼ばれ、`/admin` 配下のすべてのページで表示される
 * - 「物件一覧」「新規作成」だけのシンプルな構成（v0.11.0 では機能はこの 2 つに限定）
 * - 翻訳は `admin.*` を引く
 * - `aria-label` で landmark を識別可能にする
 */

type AdminNavProps = {
  readonly className?: string;
};

const NAV_ITEMS = [
  { href: "/admin", key: "list" },
  { href: "/admin/properties/new", key: "create" },
] as const;

export const AdminNav = ({ className }: AdminNavProps): React.JSX.Element => {
  const t = useTranslations("admin");
  return (
    <nav
      aria-label={t("navAriaLabel")}
      className={cn(
        "flex items-center gap-4 border-b border-neutral-200 bg-white/80 px-6 py-3 text-sm",
        className,
      )}
    >
      <ul className="flex items-center gap-4">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-neutral-700 transition-colors hover:text-brand-600 focus-visible:text-brand-600"
            >
              {t(item.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
