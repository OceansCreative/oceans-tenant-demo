"use client";

import {
  type BuildingType,
  buildingTypeLabel,
  type Condition,
  conditionLabel,
} from "@oceans-tenant/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatJpyCompact } from "@/lib/format";
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
 * 業種 ref のラベルは `SearchFilter` の `BUSINESS_CATEGORY_OPTIONS` と二重管理になるが、
 * v0.7.0 時点ではどちらもクライアント側の小さな定数なので意図的に局所重複を許容する。
 * 後続で `@oceans-tenant/shared` に集約する余地あり。
 */
const BUSINESS_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  "category-cafe": "カフェ",
  "category-restaurant": "レストラン",
  "category-bar": "バー / 居酒屋",
  "category-retail": "物販 / 小売",
  "category-beauty": "美容 / サロン",
  "category-office": "オフィス",
  "category-fitness": "フィットネス",
  "category-clinic": "クリニック",
};

type Chip = {
  readonly key: string;
  readonly label: string;
  readonly removeAriaLabel: string;
  readonly next: SearchCriteria;
};

const buildChips = (criteria: SearchCriteria): ReadonlyArray<Chip> => {
  const chips: Chip[] = [];
  if (criteria.prefecture) {
    chips.push({
      key: `prefecture:${criteria.prefecture}`,
      label: criteria.prefecture,
      removeAriaLabel: `${criteria.prefecture} を解除`,
      next: { ...criteria, prefecture: undefined, page: 1 },
    });
  }
  if (criteria.city) {
    chips.push({
      key: `city:${criteria.city}`,
      label: `市区町村: ${criteria.city}`,
      removeAriaLabel: `市区町村 ${criteria.city} を解除`,
      next: { ...criteria, city: undefined, page: 1 },
    });
  }
  if (criteria.minRent !== undefined) {
    chips.push({
      key: `minRent:${criteria.minRent}`,
      label: `賃料下限: ${formatJpyCompact(criteria.minRent)}`,
      removeAriaLabel: "賃料下限を解除",
      next: { ...criteria, minRent: undefined, page: 1 },
    });
  }
  if (criteria.maxRent !== undefined) {
    chips.push({
      key: `maxRent:${criteria.maxRent}`,
      label: `賃料上限: ${formatJpyCompact(criteria.maxRent)}`,
      removeAriaLabel: "賃料上限を解除",
      next: { ...criteria, maxRent: undefined, page: 1 },
    });
  }
  if (criteria.minArea !== undefined) {
    chips.push({
      key: `minArea:${criteria.minArea}`,
      label: `面積下限: ${criteria.minArea} ㎡`,
      removeAriaLabel: "面積下限を解除",
      next: { ...criteria, minArea: undefined, page: 1 },
    });
  }
  if (criteria.maxArea !== undefined) {
    chips.push({
      key: `maxArea:${criteria.maxArea}`,
      label: `面積上限: ${criteria.maxArea} ㎡`,
      removeAriaLabel: "面積上限を解除",
      next: { ...criteria, maxArea: undefined, page: 1 },
    });
  }
  for (const value of criteria.buildingTypes) {
    const label = buildingTypeLabel[value];
    chips.push({
      key: `buildingType:${value}`,
      label,
      removeAriaLabel: `${label} を解除`,
      next: {
        ...criteria,
        buildingTypes: criteria.buildingTypes.filter((v): v is BuildingType => v !== value),
        page: 1,
      },
    });
  }
  for (const value of criteria.conditions) {
    const label = conditionLabel[value];
    chips.push({
      key: `condition:${value}`,
      label,
      removeAriaLabel: `${label} を解除`,
      next: {
        ...criteria,
        conditions: criteria.conditions.filter((v): v is Condition => v !== value),
        page: 1,
      },
    });
  }
  for (const value of criteria.businessCategoryRefs) {
    const label = BUSINESS_CATEGORY_LABELS[value] ?? value;
    chips.push({
      key: `biz:${value}`,
      label,
      removeAriaLabel: `${label} を解除`,
      next: {
        ...criteria,
        businessCategoryRefs: criteria.businessCategoryRefs.filter((v) => v !== value),
        page: 1,
      },
    });
  }
  if (criteria.q) {
    chips.push({
      key: `q:${criteria.q}`,
      label: `キーワード: ${criteria.q}`,
      removeAriaLabel: `キーワード ${criteria.q} を解除`,
      next: { ...criteria, q: undefined, page: 1 },
    });
  }
  return chips;
};

const buildHref = (criteria: SearchCriteria): string => {
  const params = serializeSearchCriteria(criteria);
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
};

export const FilterChips = ({ className }: FilterChipsProps): React.JSX.Element | null => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const criteria = useMemo<SearchCriteria>(() => {
    if (!searchParams) return EMPTY_CRITERIA;
    return parseSearchCriteria(new URLSearchParams(searchParams.toString()));
  }, [searchParams]);

  const chips = useMemo(() => buildChips(criteria), [criteria]);

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
      aria-label="適用中のフィルタ"
      data-pending={isPending ? "true" : "false"}
      data-testid="filter-chips"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <span className="text-xs font-medium text-neutral-500">適用中:</span>
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
        すべてクリア
      </button>
    </section>
  );
};
