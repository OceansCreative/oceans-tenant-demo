"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ChangeEvent, useId, useTransition } from "react";
import { isLocale, LOCALE_COOKIE_NAME, type Locale, localeLabels, locales } from "@/i18n/config";
import { cn } from "@/lib/cn";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * locale 切替時に `NEXT_LOCALE` cookie を更新する。
 *
 * - URL prefix を使わない方針なので、locale 切替は cookie 書き換え + ページ再読み込みで実現する。
 * - `document.cookie` で同期的に書き込み、`router.refresh()` 相当として `location.reload()` を呼ぶ。
 *   これにより RSC が新しい locale で再レンダリングされ、Header / Footer / metadata までが切り替わる。
 * - `localStorage` / `sessionStorage` は CLAUDE.md で禁止のため使用しない。
 */
const writeLocaleCookie = (locale: Locale): void => {
  if (typeof document === "undefined") {
    return;
  }
  // Cookie Store API は本稿執筆時点で Safari 未対応。サーバ側 middleware（cookie ベース）と
  // 一貫性を取るため、シンプルに `document.cookie` で 1 ファイルだけ書き込む。
  // biome-ignore lint/suspicious/noDocumentCookie: locale 保存は cookie ベースで意図的に行う
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
};

type LocaleSwitcherProps = {
  readonly className?: string;
};

/**
 * Header から呼び出す言語切替 UI。
 *
 * - a11y: `<label>` と `<select>` を関連付け、サイズ別に visual hidden / 可視を切替える
 * - 同じ locale を選択した場合は何もしない（不要な reload を避ける）
 */
export const LocaleSwitcher = ({ className }: LocaleSwitcherProps): React.JSX.Element => {
  const currentLocale = useLocale();
  const t = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const selectId = useId();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = event.target.value;
    if (!isLocale(next) || next === currentLocale) {
      return;
    }
    startTransition(() => {
      writeLocaleCookie(next);
      // RSC を再評価するために full reload。SPA 内で完結したい場合は将来 `router.refresh()` 化検討。
      window.location.reload();
    });
  };

  return (
    <div className={cn("flex items-center gap-2 text-sm text-neutral-700", className)}>
      <label htmlFor={selectId} className="sr-only">
        {t("languageSwitcher")}
      </label>
      <select
        id={selectId}
        value={currentLocale}
        onChange={handleChange}
        disabled={isPending}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-progress disabled:opacity-60"
        aria-label={t("languageSwitcher")}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeLabels[locale]}
          </option>
        ))}
      </select>
    </div>
  );
};
