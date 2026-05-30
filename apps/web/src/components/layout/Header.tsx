import Link from "next/link";
import { cn } from "@/lib/cn";
import { SITE_CONFIG } from "@/lib/site";

type HeaderProps = {
  readonly className?: string;
};

export const Header = ({ className }: HeaderProps): React.JSX.Element => {
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
          aria-label="OceansTenant トップへ"
        >
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-white text-sm font-bold"
          >
            OT
          </span>
          <span className="text-lg tracking-wide">OceansTenant</span>
        </Link>

        <nav aria-label="主要ナビゲーション" className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm text-neutral-700">
            {SITE_CONFIG.navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition-colors hover:text-brand-600 focus-visible:text-brand-600"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/agent/ingest"
            className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 md:inline-flex"
          >
            物件を登録
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 md:hidden"
            aria-label="メニューを開く"
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
