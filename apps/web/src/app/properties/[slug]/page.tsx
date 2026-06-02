import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PropertyMapLazy } from "@/components/map/PropertyMapLazy";
import { AvailabilityBadge } from "@/components/property/AvailabilityBadge";
import { RelatedProperties } from "@/components/property/RelatedProperties";
import { formatAddressSummary, formatJpy, formatSquareMeter, formatTsubo } from "@/lib/format";
import { createEnumLabelLookupAsync } from "@/lib/i18n/enum-labels";
import { findRelatedProperties } from "@/lib/properties";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { buildPropertyJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";

export const revalidate = 60;

type PageProps = {
  readonly params: Promise<{ slug: string }>;
};

const getBaseUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  const base = raw && raw.length > 0 ? raw : "http://localhost:3000";
  return base.replace(/\/$/, "");
};

export const generateStaticParams = async (): Promise<Array<{ slug: string }>> =>
  MOCK_PROPERTIES.map((p) => ({ slug: p.slug }));

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const { slug } = await params;
  const property = MOCK_PROPERTIES.find((p) => p.slug === slug);
  if (!property) {
    const t = await getTranslations("property");
    return { title: t("notFoundTitle") };
  }
  const ogImageUrl = `/og/property/${property.slug}`;
  const canonicalUrl = `/properties/${property.slug}`;
  return {
    title: property.title,
    description: property.description ?? formatAddressSummary(property.address),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      title: property.title,
      description: property.description ?? formatAddressSummary(property.address),
      url: canonicalUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: property.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: property.title,
      description: property.description ?? formatAddressSummary(property.address),
      images: [ogImageUrl],
    },
  };
};

const PropertyDetailPage = async ({ params }: PageProps): Promise<React.JSX.Element> => {
  const { slug } = await params;
  const property = MOCK_PROPERTIES.find((p) => p.slug === slug);
  if (!property) {
    notFound();
  }

  const [tCommon, tBreadcrumb, tDetail, enumLabels] = await Promise.all([
    getTranslations("property"),
    getTranslations("property.breadcrumb"),
    getTranslations("property.detail"),
    createEnumLabelLookupAsync(),
  ]);
  void tCommon; // 名前空間の存在チェック用（unused 警告回避）

  // JSON-LD は build / SSR 時に生成し、`safeParse` 失敗時は出力をスキップする。
  // 検索エンジン側に壊れた構造化データを送らないための保険。
  const jsonLd = buildPropertyJsonLd(property, getBaseUrl());

  // 関連物件は同じ都道府県 + buildingType / suitableBusinessRefs 重複でスコアリングする。
  // mock 5 件だと最大 2-3 件、Sanity 実接続後は最大 3 件を想定。
  const relatedProperties = findRelatedProperties(property, MOCK_PROPERTIES, 3);

  return (
    <article className="container-page py-10">
      {jsonLd !== null && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD 出力に必須（serializeJsonLd で `<` を Unicode エスケープ済み）。
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      )}
      <nav aria-label={tBreadcrumb("ariaLabel")} className="mb-6 text-xs text-neutral-500">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/" className="hover:text-brand-600">
              {tBreadcrumb("home")}
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href={"/search" as never} className="hover:text-brand-600">
              {tBreadcrumb("search")}
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li className="text-neutral-700">{property.title}</li>
        </ol>
      </nav>

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{property.title}</h1>
          <p className="mt-2 text-sm text-neutral-600">{formatAddressSummary(property.address)}</p>
        </div>
        <AvailabilityBadge availability={property.availability} />
      </header>

      <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-brand-50 via-white to-brand-100 ring-1 ring-brand-100/60" />

      <section aria-labelledby="basic-info" className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 id="basic-info" className="text-lg font-semibold text-neutral-900">
            {tDetail("basicInfoHeading")}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-neutral-500">{tDetail("rent")}</dt>
              <dd className="font-semibold text-neutral-900">{formatJpy(property.rent)}</dd>
            </div>
            {property.commonFee !== undefined && (
              <div>
                <dt className="text-neutral-500">{tDetail("commonFee")}</dt>
                <dd className="font-semibold text-neutral-900">{formatJpy(property.commonFee)}</dd>
              </div>
            )}
            {property.depositMonths !== undefined && (
              <div>
                <dt className="text-neutral-500">{tDetail("deposit")}</dt>
                <dd className="font-semibold text-neutral-900">
                  {tDetail("depositMonths", { months: property.depositMonths })}
                </dd>
              </div>
            )}
            {property.keyMoneyMonths !== undefined && (
              <div>
                <dt className="text-neutral-500">{tDetail("keyMoney")}</dt>
                <dd className="font-semibold text-neutral-900">
                  {tDetail("keyMoneyMonths", { months: property.keyMoneyMonths })}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-neutral-500">{tDetail("area")}</dt>
              <dd className="font-semibold text-neutral-900">
                {tDetail("areaCombined", {
                  sqm: formatSquareMeter(property.area),
                  tsubo: formatTsubo(property.tsubo),
                })}
              </dd>
            </div>
            {property.floor && (
              <div>
                <dt className="text-neutral-500">{tDetail("floor")}</dt>
                <dd className="font-semibold text-neutral-900">{property.floor}</dd>
              </div>
            )}
            {property.buildingType && (
              <div>
                <dt className="text-neutral-500">{tDetail("buildingType")}</dt>
                <dd className="font-semibold text-neutral-900">
                  {enumLabels.buildingType(property.buildingType)}
                </dd>
              </div>
            )}
            {property.condition && (
              <div>
                <dt className="text-neutral-500">{tDetail("condition")}</dt>
                <dd className="font-semibold text-neutral-900">
                  {enumLabels.condition(property.condition)}
                </dd>
              </div>
            )}
            {property.previousBusiness && (
              <div>
                <dt className="text-neutral-500">{tDetail("previousBusiness")}</dt>
                <dd className="font-semibold text-neutral-900">{property.previousBusiness}</dd>
              </div>
            )}
            <div>
              <dt className="text-neutral-500">{tDetail("availabilityLabel")}</dt>
              <dd className="font-semibold text-neutral-900">
                {enumLabels.availability(property.availability)}
              </dd>
            </div>
          </dl>

          {property.description && (
            <div className="mt-6 border-t border-neutral-200 pt-6">
              <h3 className="text-sm font-semibold text-neutral-700">
                {tDetail("descriptionHeading")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-800">
                {property.description}
              </p>
            </div>
          )}

          {property.features.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {property.features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                >
                  {feature}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* `<article>` 内に置く補助コンテンツのため、`<aside>` ではなく `<div>` で landmark
            複合化（axe `landmark-complementary-is-top-level`）を回避する。
            個別の補足ブロックは `<section aria-labelledby>` でスクリーンリーダから到達可能。 */}
        <div className="space-y-4">
          <section
            aria-labelledby="inquiry-heading"
            className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6"
          >
            <h2 id="inquiry-heading" className="text-base font-semibold text-neutral-900">
              {tDetail("inquiryHeading")}
            </h2>
            <p className="mt-2 text-xs text-neutral-600">{tDetail("inquiryNote")}</p>
            <form className="mt-4 space-y-3">
              <input
                type="text"
                aria-label={tDetail("inquiryName")}
                placeholder={tDetail("inquiryName")}
                disabled
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
              />
              <input
                type="email"
                aria-label={tDetail("inquiryEmail")}
                placeholder={tDetail("inquiryEmail")}
                disabled
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
              />
              <textarea
                aria-label={tDetail("inquiryMessage")}
                placeholder={tDetail("inquiryMessage")}
                rows={4}
                disabled
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
              />
              <button
                type="button"
                disabled
                className="w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white opacity-60"
              >
                {tDetail("inquirySubmit")}
              </button>
            </form>
          </section>

          <section
            aria-labelledby="ai-question-heading"
            className="rounded-2xl border border-brand-200 bg-brand-50 p-6"
          >
            <h2 id="ai-question-heading" className="text-base font-semibold text-brand-900">
              {tDetail("aiQuestionHeading")}
            </h2>
            <p className="mt-2 text-xs text-brand-700">{tDetail("aiQuestionLead")}</p>
            <Link
              href={"/chat" as never}
              className="mt-3 inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              {tDetail("aiQuestionCta")}
            </Link>
          </section>
        </div>
      </section>

      {property.nearestStations.length > 0 && (
        <section aria-labelledby="stations-heading" className="mt-10">
          <h2 id="stations-heading" className="text-lg font-semibold text-neutral-900">
            {tDetail("stationsHeading")}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {property.nearestStations.map((station) => (
              <li
                key={`${station.line}-${station.station}`}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-semibold text-neutral-900">{station.station}</span>{" "}
                <span className="text-neutral-600">{station.line}</span>
                <span className="ml-auto block text-xs text-neutral-500">
                  {tDetail("stationWalkMinutes", { minutes: station.walkMinutes })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="map-heading" className="mt-10">
        <h2 id="map-heading" className="text-lg font-semibold text-neutral-900">
          {tDetail("mapHeading")}
        </h2>
        <div className="mt-3">
          <PropertyMapLazy properties={[property]} className="min-h-[400px]" />
        </div>
      </section>

      <RelatedProperties properties={relatedProperties} />
    </article>
  );
};

export default PropertyDetailPage;
