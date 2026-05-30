import type { Metadata } from "next";
import { PropertyCard } from "@/components/property/PropertyCard";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

export const metadata: Metadata = {
  title: "自社物件一覧",
  description: "OceansTenant 不動産会社向け 自社物件管理",
};

const AgentPropertiesPage = (): React.JSX.Element => {
  const myCompanyRef = "company-001";
  const myProperties = MOCK_PROPERTIES.filter((p) => p.listedByRef === myCompanyRef);
  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">自社物件一覧</h1>
        <p className="text-sm text-neutral-600">{myProperties.length} 件</p>
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
