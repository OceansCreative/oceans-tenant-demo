"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type FooterProps = {
  readonly className?: string;
};

/**
 * Footer のセクション定義。href と翻訳キーのみを保持し、表示文言は `footer.*` から引く。
 * 外部リンクは `external: true` を立て、`<a target="_blank">` でレンダリングする。
 */
const FOOTER_SECTIONS = [
  {
    titleKey: "service",
    links: [
      { href: "/search", key: "search" },
      { href: "/chat", key: "chat" },
    ],
  },
  {
    titleKey: "agent",
    links: [
      { href: "/agent", key: "agentPortal" },
      { href: "/agent/ingest", key: "ingest" },
    ],
  },
  {
    titleKey: "project",
    links: [
      {
        href: "https://github.com/OceansCreative/oceans-tenant-demo",
        key: "github",
        external: true,
      },
      { href: "/docs/architecture", key: "architecture" },
    ],
  },
] as const;

/**
 * グローバルフッター（Client Component）。
 *
 * v0.8.0 で next-intl 化。`common.*` / `footer.*` 名前空間を参照。
 * コピーライト年は `Date#getFullYear()` の結果を `common.copyright` の `{year}` プレースホルダに注入する。
 */
export const Footer = ({ className }: FooterProps): React.JSX.Element => {
  const tCommon = useTranslations("common");
  const tFooter = useTranslations("footer");
  const year = new Date().getFullYear();
  return (
    <footer
      className={cn("mt-24 border-t border-neutral-200 bg-neutral-50 text-neutral-700", className)}
    >
      <div className="container-page py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="text-base font-semibold text-neutral-900">{tCommon("siteName")}</p>
            <p className="mt-3 text-sm leading-relaxed">{tCommon("tagline")}</p>
          </div>
          {FOOTER_SECTIONS.map((section) => {
            const sectionTitle = tFooter(`sections.${section.titleKey}`);
            return (
              <nav key={section.titleKey} aria-label={sectionTitle}>
                <h2 className="text-sm font-semibold text-neutral-900">{sectionTitle}</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {section.links.map((link) => {
                    const label = tFooter(`links.${link.key}`);
                    const isExternal = "external" in link && link.external === true;
                    return (
                      <li key={link.href}>
                        {isExternal ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="transition-colors hover:text-brand-600"
                          >
                            {label}
                          </a>
                        ) : (
                          /* footer のリンクは画面外初期表示なので RSC ペイロード prefetch は不要。
                             初回 paint で発生する競合を避け Lighthouse TBT を下げる（v0.6.0 WS-2）。 */
                          <Link
                            href={link.href}
                            prefetch={false}
                            className="transition-colors hover:text-brand-600"
                          >
                            {label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-neutral-200 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center">
          <p>{tCommon("copyright", { year })}</p>
          <p>{tCommon("demoDisclaimer")}</p>
        </div>
      </div>
    </footer>
  );
};
