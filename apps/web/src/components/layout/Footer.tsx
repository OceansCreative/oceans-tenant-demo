import Link from "next/link";
import { cn } from "@/lib/cn";
import { SITE_CONFIG } from "@/lib/site";

type FooterProps = {
  readonly className?: string;
};

export const Footer = ({ className }: FooterProps): React.JSX.Element => {
  return (
    <footer
      className={cn("mt-24 border-t border-neutral-200 bg-neutral-50 text-neutral-700", className)}
    >
      <div className="container-page py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="text-base font-semibold text-neutral-900">{SITE_CONFIG.name}</p>
            <p className="mt-3 text-sm leading-relaxed">{SITE_CONFIG.tagline}</p>
          </div>
          {SITE_CONFIG.footer.sections.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h2 className="text-sm font-semibold text-neutral-900">{section.title}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {section.links.map((link) => {
                  const isExternal = link.href.startsWith("http");
                  return (
                    <li key={link.href}>
                      {isExternal ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="transition-colors hover:text-brand-600"
                        >
                          {link.label}
                        </a>
                      ) : (
                        /* footer のリンクは画面外初期表示なので RSC ペイロード prefetch は不要。
                           初回 paint で発生する競合を避け Lighthouse TBT を下げる（v0.6.0 WS-2）。 */
                        <Link
                          href={link.href}
                          prefetch={false}
                          className="transition-colors hover:text-brand-600"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-neutral-200 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center">
          <p>{SITE_CONFIG.footer.copyright}</p>
          <p>本サイトは OSS リファレンス実装のデモであり、本番運用を想定していません。</p>
        </div>
      </div>
    </footer>
  );
};
