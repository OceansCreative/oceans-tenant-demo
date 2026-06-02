import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE_NAME } from "@/i18n/config";

/**
 * Locale 解決用 middleware。
 *
 * - URL prefix は使わない（cookie ベース）ため、locale 切替時の rewrite/redirect は行わない。
 * - 既に `NEXT_LOCALE` cookie が設定されている場合は何もしない。
 * - cookie が未設定の場合は `Accept-Language` ヘッダから初期 locale を推定して cookie に保存し、
 *   以降の SSR / Client がその値を即座に参照できるようにする。
 *
 * これにより、初回アクセスでもブラウザ言語に応じた表示が可能になる。
 * cookie は Path=/ で 1 年保持（next-intl 公式の推奨値と一致）。
 */

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const parseAcceptLanguage = (header: string | null): string | null => {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";
    const base = tag.split("-")[0] ?? "";
    if (isLocale(base)) {
      return base;
    }
  }
  return null;
};

export const middleware = (request: NextRequest): NextResponse => {
  const response = NextResponse.next();

  const existing = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(existing)) {
    return response;
  }

  const fromHeader = parseAcceptLanguage(request.headers.get("accept-language"));
  const initial = fromHeader ?? defaultLocale;
  response.cookies.set({
    name: LOCALE_COOKIE_NAME,
    value: initial,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
  return response;
};

export const config = {
  /**
   * 静的アセット・API・Next.js 内部パスを除外して、ページ遷移時のみ middleware を走らせる。
   * Studio (`/studio`) は Sanity の Single Page App であり cookie 推定は不要だが、
   * ヘッダ・フッタ翻訳のため対象に含める。
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|og|robots.txt|sitemap.xml).*)"],
};
