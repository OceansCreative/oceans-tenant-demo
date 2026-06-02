"use client";

import type { PropertyWithTsubo } from "@oceans-tenant/shared";
import { useTranslations } from "next-intl";
import { PropertyCard } from "@/components/property/PropertyCard";
import { cn } from "@/lib/cn";

type RelatedPropertiesProps = {
  readonly properties: ReadonlyArray<PropertyWithTsubo>;
  readonly className?: string;
};

/**
 * 物件詳細ページ下部に表示する「関連物件」セクション。
 *
 * - PropertyCard を内部で再利用するため Client Component 化
 * - `properties` が空のときはセクション自体を描画しない（呼び出し側のレイアウト崩れ防止）
 * - 1 〜 N 件まで対応。`PropertyCard` を再利用し、レスポンシブ grid で並べる
 * - a11y: `<section aria-labelledby>` でランドマーク化、`<h2>` で見出しレベル維持
 */
export const RelatedProperties = ({
  properties,
  className,
}: RelatedPropertiesProps): React.JSX.Element | null => {
  const t = useTranslations("property.related");
  if (properties.length === 0) return null;
  return (
    <section
      aria-labelledby="related-properties-heading"
      className={cn("mt-12", className)}
      data-testid="related-properties"
    >
      <h2 id="related-properties-heading" className="text-lg font-semibold text-neutral-900">
        {t("heading")}
      </h2>
      <p className="mt-1 text-xs text-neutral-500">{t("lead", { count: properties.length })}</p>
      <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <li key={property.slug}>
            <PropertyCard property={property} className="h-full" />
          </li>
        ))}
      </ul>
    </section>
  );
};
