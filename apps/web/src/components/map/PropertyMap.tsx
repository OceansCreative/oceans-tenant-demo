"use client";

import type { PropertyWithTsubo } from "@oceans-tenant/shared";
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  InfoWindow,
  Pin,
} from "@vis.gl/react-google-maps";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatJpyCompact, formatSquareMeter } from "@/lib/format";

type PropertyMapProps = {
  readonly properties: ReadonlyArray<PropertyWithTsubo>;
  readonly className?: string;
};

const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 }; // 東京駅

const computeCenter = (
  properties: ReadonlyArray<PropertyWithTsubo>,
): { lat: number; lng: number } => {
  if (properties.length === 0) return DEFAULT_CENTER;
  const sum = properties.reduce(
    (acc, p) => {
      acc.lat += p.address.geopoint.lat;
      acc.lng += p.address.geopoint.lng;
      return acc;
    },
    { lat: 0, lng: 0 },
  );
  return {
    lat: sum.lat / properties.length,
    lng: sum.lng / properties.length,
  };
};

export const PropertyMap = ({ properties, className }: PropertyMapProps): React.JSX.Element => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const center = useMemo(() => computeCenter(properties), [properties]);
  const activeProperty = activeSlug ? properties.find((p) => p.slug === activeSlug) : null;

  if (!apiKey) {
    return (
      <section
        aria-label="地図ビュー（無効化）"
        className={cn(
          "flex h-full min-h-[480px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center",
          className,
        )}
      >
        <p className="text-sm font-semibold text-neutral-700">地図ビューは無効化されています</p>
        <p className="max-w-md text-xs leading-relaxed text-neutral-500">
          <code className="rounded bg-white px-1 py-0.5">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>
          を環境変数に設定するとここに Google Maps が表示されます。
        </p>
        <p className="text-xs text-neutral-500">
          現在 {properties.length} 件の物件がマップ表示候補です。
        </p>
      </section>
    );
  }

  return (
    <div
      className={cn(
        "h-full min-h-[480px] overflow-hidden rounded-2xl border border-neutral-200 shadow-sm",
        className,
      )}
    >
      <APIProvider apiKey={apiKey} libraries={["marker"]}>
        <GoogleMap
          mapId="oceans-tenant-search"
          defaultCenter={center}
          defaultZoom={11}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="h-full w-full"
        >
          {properties.map((property) => (
            <AdvancedMarker
              key={property.slug}
              position={property.address.geopoint}
              onClick={() => setActiveSlug(property.slug)}
            >
              <Pin
                background="var(--color-brand-600, #2563eb)"
                glyphColor="white"
                borderColor="white"
              />
            </AdvancedMarker>
          ))}

          {activeProperty && (
            <InfoWindow
              position={activeProperty.address.geopoint}
              onCloseClick={() => setActiveSlug(null)}
            >
              <div className="space-y-1 px-1 py-1 text-neutral-800">
                <p className="text-sm font-semibold">{activeProperty.title}</p>
                <p className="text-xs text-neutral-600">
                  {activeProperty.address.prefecture} {activeProperty.address.city}
                </p>
                <p className="text-xs">
                  {formatJpyCompact(activeProperty.rent)} ・{" "}
                  {formatSquareMeter(activeProperty.area)}
                </p>
                <a
                  href={`/properties/${activeProperty.slug}`}
                  className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline"
                >
                  詳細を見る →
                </a>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </APIProvider>
    </div>
  );
};
