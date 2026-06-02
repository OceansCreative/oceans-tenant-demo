import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PropertyCard } from "@/components/property/PropertyCard";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("agent.properties");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
};

const AgentPropertiesPage = async (): Promise<React.JSX.Element> => {
  const t = await getTranslations("agent.properties");
  const myCompanyRef = "company-001";
  const myProperties = MOCK_PROPERTIES.filter((p) => p.listedByRef === myCompanyRef);
  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">{t("pageTitle")}</h1>
        <p className="text-sm text-neutral-600">{t("count", { count: myProperties.length })}</p>
      </header>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {myProperties.map((property) => (
          <li key={property.slug}>
            <PropertyCard property={property} className="h-full" />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AgentPropertiesPage;
