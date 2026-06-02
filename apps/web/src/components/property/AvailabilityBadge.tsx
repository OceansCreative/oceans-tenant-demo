"use client";

import type { Availability } from "@oceans-tenant/shared";
import { cn } from "@/lib/cn";
import { useEnumLabelLookup } from "@/lib/i18n/enum-labels";

const STYLE_MAP: Readonly<Record<Availability, string>> = {
  public: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  negotiating: "bg-amber-50 text-amber-700 ring-amber-200",
  closed: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

type AvailabilityBadgeProps = {
  readonly availability: Availability;
  readonly className?: string;
};

/**
 * 物件の公開状態をバッジ表示する。
 *
 * 表示文字列は `useEnumLabelLookup()` を介して locale 別に解決する。
 * 「公開中」「商談中」「成約」（ja）/ "Available" / "In negotiation" / "Closed" (en) を返す。
 */
export const AvailabilityBadge = ({
  availability,
  className,
}: AvailabilityBadgeProps): React.JSX.Element => {
  const enumLabels = useEnumLabelLookup();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLE_MAP[availability],
        className,
      )}
    >
      {enumLabels.availability(availability)}
    </span>
  );
};
