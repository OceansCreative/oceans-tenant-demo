/**
 * i18n の共通設定（次の値を一元管理する）。
 *
 * - 対応ロケール一覧（`ja` / `en`）
 * - デフォルトロケール（`ja`）
 * - locale 切替時の cookie 名
 *
 * 本プロジェクトは URL prefix を使わず cookie ベースで locale を保持する方針（CLAUDE.md）。
 * `localStorage` / `sessionStorage` は禁止のため cookie のみで永続化する。
 */

export const locales = ["ja", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ja";

/**
 * Cookie 名。`NEXT_LOCALE` は next-intl 公式ドキュメントで推奨されている命名と一致。
 * Server / Client / middleware すべてが同じ名前で参照するため、ここで定数化する。
 */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/**
 * locale ごとの表示ラベル。LocaleSwitcher 等で利用する。
 */
export const localeLabels: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
};

/**
 * 与えられた文字列が対応 locale か判定する型ガード。
 */
export const isLocale = (value: unknown): value is Locale => {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
};
