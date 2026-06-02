import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatJpyCompact } from "@/lib/format";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("agent.dashboard");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
};

const AgentDashboardPage = async (): Promise<React.JSX.Element> => {
  const t = await getTranslations("agent.dashboard");
  // デモのため固定の会社で集計（spec の禁止事項により認証は実装しない）
  const myCompanyRef = "company-001";
  const myProperties = MOCK_PROPERTIES.filter((p) => p.listedByRef === myCompanyRef);
  const totalRent = myProperties.reduce((sum, p) => sum + p.rent, 0);
  const avgRent = myProperties.length > 0 ? totalRent / myProperties.length : 0;
  const publicCount = myProperties.filter((p) => p.availability === "public").length;

  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{t("pageTitle")}</h1>
          <p className="text-sm text-neutral-600">{t("lead", { company: myCompanyRef })}</p>
        </div>
        <Link
          href={"/agent/ingest" as never}
          className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          {t("ingestCta")}
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-xs text-neutral-500">{t("stats.totalProperties")}</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{myProperties.length}</p>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-xs text-neutral-500">{t("stats.publicProperties")}</p>
          <p className="mt-2 text-3xl font-bold text-brand-700">{publicCount}</p>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-xs text-neutral-500">{t("stats.avgRent")}</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            {avgRent > 0 ? formatJpyCompact(Math.round(avgRent)) : "—"}
          </p>
        </article>
      </section>

      <section className="mt-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">{t("ownProperties")}</h2>
          <Link
            href={"/agent/properties" as never}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            {t("viewAll")}
          </Link>
        </div>
        {myProperties.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
            {t("emptyProperties")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myProperties.slice(0, 6).map((property) => (
              <li
                key={property.slug}
                className="rounded-xl border border-neutral-200 bg-white p-4 text-sm"
              >
                <p className="font-semibold text-neutral-900">{property.title}</p>
                <p className="mt-1 text-xs text-neutral-600">
                  {property.address.prefecture} {property.address.city} ・{" "}
                  {formatJpyCompact(property.rent)}
                </p>
                <Link
                  href={`/properties/${property.slug}` as never}
                  className="mt-2 inline-block text-xs text-brand-600 hover:underline"
                >
                  {t("viewDetail")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AgentDashboardPage;
