"use client";

import type { BuildingType, Condition } from "@oceans-tenant/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatJpyCompact } from "@/lib/format";
import { useEnumLabelLookup } from "@/lib/i18n/enum-labels";
import {
  EMPTY_CRITERIA,
  parseSearchCriteria,
  type SearchCriteria,
  serializeSearchCriteria,
} from "@/lib/search-criteria";

type FilterChipsProps = {
  readonly className?: string;
};

/**
 * 検索一覧の上部で「適用中のフィルタ」を chip 表示するクライアントコンポーネント。
 *
 * - URL クエリを唯一の状態として扱う（localStorage 禁止規約 / SSR と整合）
 * - chip クリックで該当フィルタのみを URL から除去し `router.replace`
 * - 「すべてクリア」で空 criteria を適用
 * - chip 0 件のときは何も描画しない（DOM 余白も発生させない）
 * - `SearchFilter` と同様に `useTransition` でリスト再描画をブロックしない
 *
 * 業種 ref のラベルは `SearchFilter` の業種定数と二重管理になるが、
 * v0.9.0 時点ではどちらもクライアント側の小さな定数なので意図的に局所重複を許容する。
 * 後続で `@oceans-tenant/shared` に集約する余地あり。
 */
const BUSINESS_CATEGORY_LABEL_KEYS: Readonly<Record<string, string>> = {
  "category-cafe": "cafe",
  "category-restaurant": "restaurant",
  "category-bar": "bar",
  "category-retail": "retail",
  "category-beauty": "beauty",
  "category-office": "office",
  "category-fitness": "fitness",
  "category-clinic": "clinic",
};

type Chip = {
  readonly key: string;
  readonly label: string;
  readonly removeAriaLabel: string;
  readonly next: SearchCriteria;
};

const buildHref = (criteria: SearchCriteria): string => {
  const params = serializeSearchCriteria(criteria);
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
};

export const FilterChips = ({ className }: FilterChipsProps): React.JSX.Element | null => {
  const tChips = useTranslations("search.chips");
  const tCategory = useTranslations("search.businessCategory");
  const enumLabels = useEnumLabelLookup();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const criteria = useMemo<SearchCriteria>(() => {
    if (!searchParams) return EMPTY_CRITERIA;
    return parseSearchCriteria(new URLSearchParams(searchParams.toString()));
  }, [searchParams]);

  const chips = useMemo<ReadonlyArray<Chip>>(() => {
    const items: Chip[] = [];
    if (criteria.prefecture) {
      const value = criteria.prefecture;
      items.push({
        key: `prefecture:${value}`,
        label: value,
        removeAriaLabel: tChips("removeAriaLabel", { label: value }),
        next: { ...criteria, prefecture: undefined, page: 1 },
      });
    }
    if (criteria.city) {
      const value = criteria.city;
      items.push({
        key: `city:${value}`,
        label: tChips("cityLabel", { value }),
        removeAriaLabel: tChips("cityRemoveAriaLabel", { value }),
        next: { ...criteria, city: undefined, page: 1 },
      });
    }
    if (criteria.minRent !== undefined) {
      items.push({
        key: `minRent:${criteria.minRent}`,
        label: tChips("minRentLabel", { value: formatJpyCompact(criteria.minRent) }),
        removeAriaLabel: tChips("minRentRemoveAriaLabel"),
        next: { ...criteria, minRent: undefined, page: 1 },
      });
    }
    if (criteria.maxRent !== undefined) {
      items.push({
        key: `maxRent:${criteria.maxRent}`,
        label: tChips("maxRentLabel", { value: formatJpyCompact(criteria.maxRent) }),
        removeAriaLabel: tChips("maxRentRemoveAriaLabel"),
        next: { ...criteria, maxRent: undefined, page: 1 },
      });
    }
    if (criteria.minArea !== undefined) {
      items.push({
        key: `minArea:${criteria.minArea}`,
        label: tChips("minAreaLabel", { value: criteria.minArea }),
        removeAriaLabel: tChips("minAreaRemoveAriaLabel"),
        next: { ...criteria, minArea: undefined, page: 1 },
      });
    }
    if (criteria.maxArea !== undefined) {
      items.push({
        key: `maxArea:${criteria.maxArea}`,
        label: tChips("maxAreaLabel", { value: criteria.maxArea }),
        removeAriaLabel: tChips("maxAreaRemoveAriaLabel"),
        next: { ...criteria, maxArea: undefined, page: 1 },
      });
    }
    for (const value of criteria.buildingTypes) {
      const label = enumLabels.buildingType(value);
      items.push({
        key: `buildingType:${value}`,
        label,
        removeAriaLabel: tChips("removeAriaLabel", { label }),
        next: {
          ...criteria,
          buildingTypes: criteria.buildingTypes.filter((v): v is BuildingType => v !== value),
          page: 1,
        },
      });
    }
    for (const value of criteria.conditions) {
      const label = enumLabels.condition(value);
      items.push({
        key: `condition:${value}`,
        label,
        removeAriaLabel: tChips("removeAriaLabel", { label }),
        next: {
          ...criteria,
          conditions: criteria.conditions.filter((v): v is Condition => v !== value),
          page: 1,
        },
      });
    }
    for (const value of criteria.businessCategoryRefs) {
      const labelKey = BUSINESS_CATEGORY_LABEL_KEYS[value];
      const label = labelKey ? tCategory(labelKey) : value;
      items.push({
        key: `biz:${value}`,
        label,
        removeAriaLabel: tChips("removeAriaLabel", { label }),
        next: {
          ...criteria,
          businessCategoryRefs: criteria.businessCategoryRefs.filter((v) => v !== value),
          page: 1,
        },
      });
    }
    if (criteria.q) {
      const value = criteria.q;
      items.push({
        key: `q:${value}`,
        label: tChips("keywordLabel", { value }),
        removeAriaLabel: tChips("keywordRemoveAriaLabel", { value }),
        next: { ...criteria, q: undefined, page: 1 },
      });
    }
    return items;
  }, [criteria, enumLabels, tCategory, tChips]);

  const apply = useCallback(
    (next: SearchCriteria) => {
      startTransition(() => {
        router.replace(buildHref(next) as never);
      });
    },
    [router],
  );

  if (chips.length === 0) return null;

  return (
    <section
      aria-label={tChips("regionAriaLabel")}
      data-pending={isPending ? "true" : "false"}
      data-testid="filter-chips"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <span className="text-xs font-medium text-neutral-500">{tChips("appliedPrefix")}</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => apply(chip.next)}
          disabled={isPending}
          aria-label={chip.removeAriaLabel}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50",
          )}
        >
          <span>{chip.label}</span>
          <span aria-hidden="true" className="text-brand-500">
            ×
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => apply(EMPTY_CRITERIA)}
        disabled={isPending}
        className="text-xs font-medium text-neutral-600 underline hover:text-brand-700 disabled:opacity-50"
      >
        {tChips("clearAll")}
      </button>
    </section>
  );
};
