import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { isAdminEnabled } from "@/lib/admin/feature-flag";

/**
 * `/admin` 配下の共通レイアウト。
 *
 * 設計判断:
 * - **feature flag は layout.tsx で再度検証**: middleware で 404 にリライトする一段目のガードに加え、
 *   layout でも `isAdminEnabled()` を確認して `notFound()` を呼ぶ二重防御を実装する。
 *   これにより、middleware の matcher パターン変更で漏れがあっても admin 画面が露出しない。
 * - 認証は実装しない（demo / OSS 想定）。env のみで可視性を制御する。
 * - 共通ナビ `AdminNav` を layout で常設し、各ページは中身のみに集中する。
 *
 * @remarks
 *   この `notFound()` は Next.js の最寄り `not-found.tsx` を探す。
 *   `/admin/not-found.tsx` が存在するため、admin 用にデザインされた 404 が描画される。
 */

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("admin");
  return {
    title: t("title"),
    description: t("pageDescription"),
    robots: { index: false, follow: false },
  };
};

type AdminLayoutProps = {
  readonly children: React.ReactNode;
};

const AdminLayout = async ({ children }: AdminLayoutProps): Promise<React.JSX.Element> => {
  if (!isAdminEnabled()) {
    notFound();
  }
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <AdminNav />
      <div className="flex-1">{children}</div>
    </div>
  );
};

export default AdminLayout;
