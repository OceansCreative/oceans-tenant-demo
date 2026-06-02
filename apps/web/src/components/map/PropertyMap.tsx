"use client";

import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { PropertyWithTsubo } from "@oceans-tenant/shared";
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  InfoWindow,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatJpyCompact, formatSquareMeter } from "@/lib/format";

type PropertyMapProps = {
  readonly properties: ReadonlyArray<PropertyWithTsubo>;
  readonly className?: string;
};

const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 }; // 東京駅

/**
 * クラスタリングを有効化する物件件数の閾値。
 *
 * - mock 5 件 / 一般的な検索結果（1 ページあたり 20 件）では効果が薄い
 * - Sanity 実接続後に件数が増えたタイミングで効くよう、10 件以上で発動する
 * - この閾値未満では従来通り個別ピンを描画する（テスト互換性も維持）
 */
export const CLUSTERING_THRESHOLD = 10;

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

type ClusterableMarkerProps = {
  readonly property: PropertyWithTsubo;
  readonly onClick: () => void;
  readonly registerMarker: (
    slug: string,
    element: google.maps.marker.AdvancedMarkerElement | null,
  ) => void;
};

/**
 * AdvancedMarker を描画しつつ、生の `AdvancedMarkerElement` を MarkerClusterer へ登録する。
 *
 * `ref` callback で要素のライフサイクルを親側に通知し、親が `MarkerClusterer.addMarker` /
 * `removeMarker` を呼べるようにする。`@vis.gl/react-google-maps` の `useAdvancedMarkerRef`
 * フックでも同等の参照取得は可能だが、ここでは slug をキーとしたコレクション管理が必要なため
 * 自前で `ref` callback を使う。
 */
const ClusterableMarker = ({
  property,
  onClick,
  registerMarker,
}: ClusterableMarkerProps): React.JSX.Element => {
  return (
    <AdvancedMarker
      position={property.address.geopoint}
      onClick={onClick}
      ref={(marker) => {
        registerMarker(property.slug, marker);
      }}
    >
      <Pin background="var(--color-brand-600, #2563eb)" glyphColor="white" borderColor="white" />
    </AdvancedMarker>
  );
};

type MarkersLayerProps = {
  readonly properties: ReadonlyArray<PropertyWithTsubo>;
  readonly onMarkerClick: (slug: string) => void;
};

/**
 * `MarkerClusterer` の生成と寿命管理を担うレイヤ。
 *
 * - `useMap` で map インスタンスを取得
 * - properties 件数が `CLUSTERING_THRESHOLD` 以上のときだけ clusterer を生成
 * - 閾値未満のときはマーカーを個別表示（clusterer なし）
 * - マウント解除時 / properties 変更時に clusterer をクリーンアップ
 */
const MarkersLayer = ({ properties, onMarkerClick }: MarkersLayerProps): React.JSX.Element => {
  const map = useMap();
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const shouldCluster = properties.length >= CLUSTERING_THRESHOLD;

  const registerMarker = (
    slug: string,
    element: google.maps.marker.AdvancedMarkerElement | null,
  ): void => {
    if (element) {
      markersRef.current.set(slug, element);
    } else {
      markersRef.current.delete(slug);
    }
  };

  // properties が変わるたびに ref 内のマーカー集合も入れ替わるため、依存に含めて
  // clusterer を作り直す必要がある（biome は ref.current 経由の読み取りを検出できない）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: properties は ref 経由で読まれるが clusterer 再構築キーとして必要。
  useEffect(() => {
    if (!map) return;
    if (!shouldCluster) {
      // 閾値未満ではクラスタリングを使わない（既存挙動と互換）
      return;
    }
    // 既存 clusterer があれば破棄してから再生成（properties が変わるたびに作り直す）
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.onRemove();
      clustererRef.current = null;
    }
    const clusterer = new MarkerClusterer({
      map,
      markers: Array.from(markersRef.current.values()),
    });
    clustererRef.current = clusterer;
    return () => {
      clusterer.clearMarkers();
      clusterer.onRemove();
      if (clustererRef.current === clusterer) {
        clustererRef.current = null;
      }
    };
  }, [map, shouldCluster, properties]);

  return (
    <>
      {properties.map((property) => (
        <ClusterableMarker
          key={property.slug}
          property={property}
          onClick={() => onMarkerClick(property.slug)}
          registerMarker={registerMarker}
        />
      ))}
    </>
  );
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
      data-clustering={properties.length >= CLUSTERING_THRESHOLD ? "enabled" : "disabled"}
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
          <MarkersLayer properties={properties} onMarkerClick={setActiveSlug} />

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
