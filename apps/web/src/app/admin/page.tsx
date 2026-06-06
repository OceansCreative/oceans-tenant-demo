import { availabilityLabel } from "@oceans-tenant/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listPropertiesForAdmin } from "@/lib/admin/mutations";
import { formatJpyCompact } from "@/lib/format";

/**
 * Admin 物件一覧ページ。
 *
 * - mock store から全件取得し、編集・削除動線を備えたシンプルなテーブルで表示する
 * - 削除ボタンは Client Component の DeletePropertyButton に切り出して
 *   `window.confirm` → `fetch DELETE` → `router.refresh()` の流れを実現
 * - Sanity 接続時の一覧経路は v0.11.0 では未対応（既存 fetchProperties() への接続は
 *   別 PR）。`listPropertiesForAdmin()` は mock store を直接読む薄い委譲関数。
 */

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("admin");
  return {
    title: t("title"),
    description: t("pageDescription"),
  };
};

const AdminListPage = async (): Promise<React.JSX.Element> => {
  const t = await getTranslations("admin");
  const tEnum = await getTranslations("enum.availability");
  const properties = listPropertiesForAdmin();
  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{t("title")}</h1>
          <p className="text-sm text-neutral-600">{t("lead")}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-700">
          <span aria-live="polite">{t("listCount", { count: properties.length })}</span>
          <Link
            href="/admin/properties/new"
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            {t("newProperty")}
          </Link>
        </div>
      </header>

      {properties.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          {t("listEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-600">
              <tr>
                <th scope="col" className="px-4 py-3">
                  {t("tableColumns.title")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("tableColumns.slug")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("tableColumns.prefecture")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("tableColumns.city")}
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  {t("tableColumns.rent")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("tableColumns.availability")}
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  {t("tableColumns.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {properties.map((property) => (
                <tr key={property.slug} data-testid="admin-property-row">
                  <td className="px-4 py-3 font-medium text-neutral-900">{property.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-700">{property.slug}</td>
                  <td className="px-4 py-3 text-neutral-700">{property.address.prefecture}</td>
                  <td className="px-4 py-3 text-neutral-700">{property.address.city}</td>
                  <td className="px-4 py-3 text-right text-neutral-700">
                    {formatJpyCompact(property.rent)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {tEnum(property.availability)} ({availabilityLabel[property.availability]})
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/properties/${property.slug}/edit`}
                      className="text-brand-600 hover:underline"
                    >
                      {t("edit")} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminListPage;
