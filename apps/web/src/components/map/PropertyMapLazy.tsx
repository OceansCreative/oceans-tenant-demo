"use client";

import type { PropertyWithTsubo } from "@oceans-tenant/shared";
import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";

/**
 * `PropertyMap` を `next/dynamic` で client-only ロードする薄いラッパ。
 *
 * 目的:
 * - `@vis.gl/react-google-maps` および Google Maps JS 側の依存を initial bundle から外す。
 * - `/search` の一覧モードや `/properties/[slug]` の初回 paint で地図 JS を実行しない。
 * - SSR 出力には `aspect-video` のスケルトンだけ含め、CLS を 0 に保ったまま遅延描画する。
 *
 * loading state はサイズが同じスケルトンに統一し、Lighthouse の Layout Shift を出さない。
 */

type PropertyMapLazyProps = {
  readonly properties: ReadonlyArray<PropertyWithTsubo>;
  readonly className?: string;
};

const MapSkeleton = ({ className }: { readonly className?: string }): React.JSX.Element => (
  <div
    aria-hidden="true"
    className={cn(
      "h-full min-h-[480px] animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100",
      className,
    )}
  />
);

const PropertyMapClient = dynamic(
  () => import("./PropertyMap").then((mod) => ({ default: mod.PropertyMap })),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

export const PropertyMapLazy = ({
  properties,
  className,
}: PropertyMapLazyProps): React.JSX.Element => {
  return <PropertyMapClient properties={properties} className={className} />;
};
