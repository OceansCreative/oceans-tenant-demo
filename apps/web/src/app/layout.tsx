import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import "@/styles/globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-jp",
});

/**
 * locale ごとに `<html lang>` と OG locale を切り替えるためのメタデータ生成。
 * next-intl の `getTranslations()` で `common.*` / `seo.*` を引き、現在の locale に応じた
 * タイトル・説明文を返す。
 */
export const generateMetadata = async (): Promise<Metadata> => {
  const [locale, tCommon, tSeo] = await Promise.all([
    getLocale(),
    getTranslations("common"),
    getTranslations("seo"),
  ]);
  const siteName = tCommon("siteName");
  const description = tCommon("description");
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    title: {
      default: tSeo("defaultTitle"),
      template: tSeo("titleTemplate"),
    },
    description,
    applicationName: siteName,
    authors: [{ name: "OceansBase" }],
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "ja_JP",
      title: siteName,
      description,
      siteName,
      images: [{ url: "/og", width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description,
      images: ["/og"],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

type RootLayoutProps = {
  readonly children: React.ReactNode;
};

const RootLayout = async ({ children }: RootLayoutProps): Promise<React.JSX.Element> => {
  const [locale, messages, tCommon] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations("common"),
  ]);
  return (
    <html lang={locale} className={notoSansJp.variable}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
          >
            {tCommon("skipToContent")}
          </a>
          <Header />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
