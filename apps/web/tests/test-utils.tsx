import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import enMessages from "../messages/en.json";
import jaMessages from "../messages/ja.json";
import type { Locale } from "../src/i18n/config";

/**
 * テストで使う locale → messages のマップ。
 *
 * `messages/*.json` を直接 import することで、テスト時は next-intl の SSR 経路を経由せず
 * 同期的に provider に渡せる。アプリ本体（RSC）は `src/i18n/request.ts` 経由でロードされるため、
 * テスト helper と本番経路は別系統。messages の中身は同一ファイルを共有する。
 */
const MESSAGES = {
  ja: jaMessages,
  en: enMessages,
} as const;

export type RenderWithI18nOptions = RenderOptions & {
  readonly locale?: Locale;
};

/**
 * `NextIntlClientProvider` を最小限ラップした `render`。
 *
 * 既存テストで `useTranslations()` を呼ぶ Client Component を扱うために導入する。
 * Provider 不要なテスト（純粋な型/関数）は引き続き `@testing-library/react` の `render` を使ってよい。
 *
 * @example
 * renderWithI18n(<Header />)
 * renderWithI18n(<Header />, { locale: "en" })
 */
export const renderWithI18n = (
  ui: ReactElement,
  { locale = "ja", ...options }: RenderWithI18nOptions = {},
): RenderResult => {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
};

/** 既存のテストファイルが `screen` / `within` / `act` 等を再 export 経由で使えるようにする。 */
export * from "@testing-library/react";
