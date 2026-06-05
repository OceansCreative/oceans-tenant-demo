import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PropertyEditForm } from "@/components/admin/PropertyEditForm";
import { getPropertyForAdmin } from "@/lib/admin/mutations";

/**
 * Admin 物件編集ページ。
 *
 * - `params.slug` で mock store から物件を取得し、PropertyEditForm に initial として渡す
 * - 物件が見つからなければ `notFound()` を呼び `/admin/not-found.tsx` を描画
 *
 * Next.js 15 で `params` は `Promise<{ slug: string }>` 型になったため await で開く。
 */

type PageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const t = await getTranslations("admin");
  const { slug } = await params;
  const property = getPropertyForAdmin(slug);
  return {
    title: property ? `${t("editTitle")}: ${property.title}` : t("editTitle"),
    description: t("pageDescription"),
  };
};

const AdminEditPropertyPage = async ({ params }: PageProps): Promise<React.JSX.Element> => {
  const t = await getTranslations("admin");
  const { slug } = await params;
  const property = getPropertyForAdmin(slug);
  if (!property) {
    notFound();
  }
  return (
    <div className="container-page py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs text-neutral-500">
          <Link href="/admin" className="hover:underline">
            ← {t("back")}
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-neutral-900">
          {t("editTitle")}: {property.title}
        </h1>
      </header>
      <PropertyEditForm initial={property} />
    </div>
  );
};

export default AdminEditPropertyPage;
