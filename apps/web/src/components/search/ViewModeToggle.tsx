"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";

export type ViewMode = "list" | "map";

const VIEW_MODES: ReadonlyArray<{ value: ViewMode; label: string; icon: string }> = [
  { value: "list", label: "一覧", icon: "▦" },
  { value: "map", label: "地図", icon: "◎" },
];

type ViewModeToggleProps = {
  readonly current: ViewMode;
  readonly className?: string;
};

export const ViewModeToggle = ({ current, className }: ViewModeToggleProps): React.JSX.Element => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setMode = (mode: ViewMode) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (mode === "list") next.delete("view");
    else next.set("view", mode);
    const query = next.toString();
    startTransition(() => {
      router.replace(`/search${query ? `?${query}` : ""}` as never);
    });
  };

  return (
    <fieldset
      aria-label="表示モード"
      className={cn(
        "inline-flex rounded-full border border-neutral-200 bg-white p-1 shadow-sm",
        className,
      )}
    >
      {VIEW_MODES.map((mode) => {
        const active = mode.value === current;
        return (
          <button
            type="button"
            key={mode.value}
            onClick={() => setMode(mode.value)}
            aria-pressed={active}
            disabled={isPending}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active ? "bg-brand-600 text-white" : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            <span aria-hidden="true" className="mr-1">
              {mode.icon}
            </span>
            {mode.label}
          </button>
        );
      })}
    </fieldset>
  );
};
