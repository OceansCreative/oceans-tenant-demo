import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE_NAME, type Locale, locales } from "./config";

/**
 * Accept-Language ヘッダから対応 locale を抽出する。
 *
 * 例: `Accept-Language: en-US,en;q=0.9,ja;q=0.8` の場合、最初にマッチする
 * `en` を返す。マッチしない場合は `null` を返す。
 *
 * BCP47 タグは `xx-YY` 形式のためプレフィックスのみで判定する（`en-US` → `en`）。
 */
const parseAcceptLanguage = (header: string | null): Locale | null => {
  if (!header) {
    return null;
  }
  const candidates = header.split(",").map((part) => {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";
    return tag.split("-")[0] ?? "";
  });
  for (const candidate of candidates) {
    if (isLocale(candidate)) {
      return candidate;
    }
  }
  return null;
};

/**
 * 現在のリクエストから locale を解決する優先順位:
 *
 * 1. cookie `NEXT_LOCALE`（ユーザーが明示的に切り替えた値）
 * 2. `Accept-Language` ヘッダの先頭マッチ
 * 3. デフォルト locale（`ja`）
 *
 * Server Components / API Route / Middleware のいずれからも利用可能にするため、
 * Next.js 標準の `cookies()` / `headers()` API のみを使う。
 */
export const resolveLocale = async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(cookieValue)) {
    return cookieValue;
  }
  const headerStore = await headers();
  const fromHeader = parseAcceptLanguage(headerStore.get("accept-language"));
  if (fromHeader) {
    return fromHeader;
  }
  return defaultLocale;
};

/**
 * next-intl の Server Component 用設定。
 *
 * `getRequestConfig` は RSC レンダリング時に呼ばれ、現在の locale と
 * 対応する messages を返す。messages は `messages/{locale}.json` から
 * 動的 import することで、未使用 locale のバンドルを避ける。
 */
export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;
  return {
    locale,
    messages,
  };
});

/**
 * テスト等から再エクスポートするための補助関数群。
 */
export { isLocale, locales };
