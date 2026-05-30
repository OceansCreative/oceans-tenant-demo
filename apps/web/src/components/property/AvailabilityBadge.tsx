import { type Availability, availabilityLabel } from "@oceans-tenant/shared";
import { cn } from "@/lib/cn";

const STYLE_MAP: Readonly<Record<Availability, string>> = {
  public: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  negotiating: "bg-amber-50 text-amber-700 ring-amber-200",
  closed: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

type AvailabilityBadgeProps = {
  readonly availability: Availability;
  readonly className?: string;
};

export const AvailabilityBadge = ({
  availability,
  className,
}: AvailabilityBadgeProps): React.JSX.Element => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
      STYLE_MAP[availability],
      className,
    )}
  >
    {availabilityLabel[availability]}
  </span>
);
