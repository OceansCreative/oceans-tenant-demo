import type { PropertyWithTsubo } from "@oceans-tenant/shared";
import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  formatAddressSummary,
  formatJpyCompact,
  formatSquareMeter,
  formatTsubo,
} from "@/lib/format";
import { AvailabilityBadge } from "./AvailabilityBadge";

type PropertyCardProps = {
  readonly property: PropertyWithTsubo;
  readonly className?: string;
};

export const PropertyCard = ({ property, className }: PropertyCardProps): React.JSX.Element => {
  const nearestStation = property.nearestStations[0];
  return (
    <article
      data-testid="property-card"
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-within:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-brand-50 via-white to-brand-100">
        <div className="absolute right-3 top-3">
          <AvailabilityBadge availability={property.availability} />
        </div>
        <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1">
          {property.features.slice(0, 3).map((feature) => (
            <span
              key={feature}
              className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-neutral-700 backdrop-blur"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-base font-semibold text-neutral-900 line-clamp-2">
          <Link
            href={`/properties/${property.slug}` as Route}
            // 検索結果 / チャット結果でカードが多数並ぶ画面では、初回 paint 時の RSC prefetch
            // が CPU を奪い TBT を悪化させる。ホバー / クリック時に Next.js が必要な分だけ
            // フェッチする挙動に切り替える（v0.6.0 WS-2）。
            prefetch={false}
            className="after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none"
          >
            {property.title}
          </Link>
        </h3>

        <p className="text-sm text-neutral-600">{formatAddressSummary(property.address)}</p>

        {nearestStation && (
          <p className="text-xs text-neutral-500">
            {nearestStation.line} {nearestStation.station} 駅 徒歩 {nearestStation.walkMinutes} 分
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="text-xs text-neutral-500">月額賃料</p>
            <p className="text-lg font-bold text-brand-700">{formatJpyCompact(property.rent)}</p>
          </div>
          <div className="text-right text-xs text-neutral-600">
            <p>{formatSquareMeter(property.area)}</p>
            <p className="text-neutral-500">{formatTsubo(property.tsubo)}</p>
          </div>
        </div>
      </div>
    </article>
  );
};
