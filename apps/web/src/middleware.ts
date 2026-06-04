import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE_NAME } from "@/i18n/config";
import { parseAdminEnabledFlag } from "@/lib/admin/feature-flag";

/**
 * Locale 解決 + Admin feature flag ガード用 middleware。
 *
 * - URL prefix は使わない（cookie ベース）ため、locale 切替時の rewrite/redirect は行わない。
 * - 既に `NEXT_LOCALE` cookie が設定されている場合は locale 設定はスキップ。
 * - cookie が未設定の場合は `Accept-Language` ヘッダから初期 locale を推定して cookie に保存し、
 *   以降の SSR / Client がその値を即座に参照できるようにする。
 * - v0.10.0 WS-1: `/admin/**` へのアクセスを feature flag で制御する。
 *   `NEXT_PUBLIC_ADMIN_ENABLED=true` でなければ rewrite で `/admin/not-found` を 404 ページとして
 *   返す（隠蔽目的）。Next.js の `notFound()` は middleware から直接呼べないため rewrite で実現。
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

/**
 * Admin pathname の判定。`/admin` および `/admin/...` を対象に含める。
 * 文字列前方一致だが、`/administration` のような誤マッチを避けるため
 * "/admin" 直後が `/` か末尾であることを要件にしている。
 */
const isAdminPath = (pathname: string): boolean =>
  pathname === "/admin" || pathname.startsWith("/admin/");

/**
 * Admin が無効な状態で `/admin/**` を踏んだ場合に 404 として処理させるための rewrite。
 *
 * Next.js の `not-found.tsx` が `/admin` 配下にあるため、`/admin/not-found` という
 * 存在しないパスへ rewrite すると、最寄りの `not-found.tsx`（= `/admin/not-found.tsx`）が
 * 404 として描画される。`response.rewrite(...)` の戻り値は通常の `NextResponse`。
 */
const rewriteToAdminNotFound = (request: NextRequest): NextResponse => {
  const url = request.nextUrl.clone();
  url.pathname = "/admin/__disabled";
  return NextResponse.rewrite(url, { status: 404 });
};

export const middleware = (request: NextRequest): NextResponse => {
  // Admin ガード: feature flag が無効なら、locale 処理より前に 404 を返す。
  if (isAdminPath(request.nextUrl.pathname)) {
    if (!parseAdminEnabledFlag(process.env.NEXT_PUBLIC_ADMIN_ENABLED)) {
      return rewriteToAdminNotFound(request);
    }
  }

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
   * `/admin` 配下も対象に含め、feature flag による 404 ガードを実施する。
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|og|robots.txt|sitemap.xml).*)"],
};
