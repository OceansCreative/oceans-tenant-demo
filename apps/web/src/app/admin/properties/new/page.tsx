import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PropertyEditForm } from "@/components/admin/PropertyEditForm";

/**
 * Admin 新規物件作成ページ。
 *
 * - `PropertyEditForm` を `initial` 無しで描画することで新規モードになる
 * - 戻る動線は AdminNav で `物件一覧` リンクを提供するが、本文上部にも back リンクを置く
 */

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("admin");
  return {
    title: t("createTitle"),
    description: t("pageDescription"),
  };
};

const AdminNewPropertyPage = async (): Promise<React.JSX.Element> => {
  const t = await getTranslations("admin");
  return (
    <div className="container-page py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs text-neutral-500">
          <Link href="/admin" className="hover:underline">
            ← {t("back")}
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-neutral-900">{t("createTitle")}</h1>
      </header>
      <PropertyEditForm />
    </div>
  );
};

export default AdminNewPropertyPage;
