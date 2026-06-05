import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Admin 配下専用の 404 ページ。
 *
 * - feature flag 無効時に middleware から `/admin/__disabled` へ rewrite されると
 *   このページが描画される（Next.js が最寄りの `not-found.tsx` を選ぶため）。
 * - 認証なし demo の前提として「Admin は無効化されています」のヒントを表示し、
 *   ホームに戻るリンクを提供する。
 * - 翻訳は `admin.disabledNotice` を使用。
 */
const AdminNotFound = async (): Promise<React.JSX.Element> => {
  const t = await getTranslations("admin");
  const tCommon = await getTranslations("common");
  return (
    <main
      id="main-content"
      className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16 text-center"
    >
      <p className="rounded-full bg-neutral-100 px-4 py-1 text-xs font-medium text-neutral-600">
        404
      </p>
      <h1 className="text-2xl font-bold text-neutral-900">{t("title")}</h1>
      <p className="max-w-prose text-sm text-neutral-600">{t("disabledNotice")}</p>
      <Link
        href="/"
        className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        {tCommon("back")}
      </Link>
    </main>
  );
};

export default AdminNotFound;
