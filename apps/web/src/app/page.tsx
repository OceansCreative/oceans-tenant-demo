import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * トップページのメタデータ。
 * `seo.*` / `common.*` 名前空間から locale 依存のタイトル・説明文を生成する。
 */
export const generateMetadata = async (): Promise<Metadata> => {
  const [tCommon, tSeo] = await Promise.all([getTranslations("common"), getTranslations("seo")]);
  const title = tSeo("defaultTitle");
  const description = tCommon("description");
  return {
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      title,
      description,
      images: [{ url: "/og", width: 1200, height: 630, alt: tCommon("siteName") }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og"],
    },
  };
};

/**
 * トップページ（Server Component）。
 *
 * v0.8.0 で next-intl 化。ヒーロー / ショーケース / 機能カードのすべてを `home.*` 名前空間から引く。
 * インタラクションは無いため Server のまま `getTranslations()` でレンダリング時に解決する。
 */
const HomePage = async (): Promise<React.JSX.Element> => {
  const tHome = await getTranslations("home");
  const showcaseItems = [
    { key: "extraction" },
    { key: "chat" },
    { key: "map" },
    { key: "cms" },
  ] as const;
  const featureItems = [{ key: "ingest" }, { key: "chat" }, { key: "stack" }] as const;
  return (
    <div className="container-page py-16 lg:py-24">
      <section className="grid items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
            {tHome("heroBadge")}
          </p>
          <h1 className="text-balance text-4xl font-bold leading-tight text-neutral-900 sm:text-5xl">
            {tHome("heroHeadline")}
          </h1>
          <p className="text-pretty text-lg leading-relaxed text-neutral-600">
            {tHome("heroLead")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              {tHome("ctaSearch")}
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-6 py-3 text-base font-medium text-neutral-800 transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              {tHome("ctaChat")}
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-[4/3] w-full rounded-3xl bg-gradient-to-br from-brand-50 via-white to-brand-100 p-6 shadow-sm ring-1 ring-brand-100/60">
            <div className="grid h-full grid-cols-2 gap-4">
              {showcaseItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl bg-white/80 p-4 ring-1 ring-neutral-200/80 backdrop-blur"
                >
                  <p className="text-sm font-semibold text-brand-700">
                    {tHome(`showcase.${item.key}.title`)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                    {tHome(`showcase.${item.key}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-24 grid gap-8 sm:grid-cols-3">
        {featureItems.map((feature) => (
          <article
            key={feature.key}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-neutral-900">
              {tHome(`features.${feature.key}.title`)}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              {tHome(`features.${feature.key}.body`)}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
};

export default HomePage;
