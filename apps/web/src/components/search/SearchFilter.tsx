"use client";

import {
  type BuildingType,
  buildingTypeLabel,
  buildingTypeValues,
  type Condition,
  conditionLabel,
  conditionValues,
  type Prefecture,
  prefectureValues,
} from "@oceans-tenant/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  EMPTY_CRITERIA,
  parseSearchCriteria,
  type SearchCriteria,
  serializeSearchCriteria,
} from "@/lib/search-criteria";

type SearchFilterProps = {
  readonly className?: string;
  /** SSR 初期描画用。Client 側では URL クエリを優先する */
  readonly initialCriteria?: SearchCriteria;
};

const BUSINESS_CATEGORY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "category-cafe", label: "カフェ" },
  { value: "category-restaurant", label: "レストラン" },
  { value: "category-bar", label: "バー / 居酒屋" },
  { value: "category-retail", label: "物販 / 小売" },
  { value: "category-beauty", label: "美容 / サロン" },
  { value: "category-office", label: "オフィス" },
  { value: "category-fitness", label: "フィットネス" },
  { value: "category-clinic", label: "クリニック" },
];

export const SearchFilter = ({
  className,
  initialCriteria,
}: SearchFilterProps): React.JSX.Element => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const criteria = useMemo<SearchCriteria>(() => {
    if (!searchParams) return initialCriteria ?? EMPTY_CRITERIA;
    return parseSearchCriteria(new URLSearchParams(searchParams.toString()));
  }, [searchParams, initialCriteria]);

  const apply = useCallback(
    (next: SearchCriteria) => {
      const params = serializeSearchCriteria(next);
      const query = params.toString();
      startTransition(() => {
        router.replace(`/search${query ? `?${query}` : ""}` as never);
      });
    },
    [router],
  );

  const update = (partial: Partial<SearchCriteria>) => {
    apply({ ...criteria, ...partial });
  };

  const toggleListValue = <T extends string>(
    current: ReadonlyArray<T>,
    value: T,
  ): ReadonlyArray<T> =>
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

  const fieldLabel = "block text-xs font-medium text-neutral-700";
  const inputBase =
    "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50";

  return (
    <aside
      aria-label="検索フィルタ"
      data-pending={isPending ? "true" : "false"}
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">フィルタ</h2>
        <button
          type="button"
          onClick={() => apply(EMPTY_CRITERIA)}
          className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
          disabled={isPending}
        >
          条件をクリア
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={fieldLabel}>都道府県</span>
          <select
            aria-label="都道府県"
            className={inputBase}
            value={criteria.prefecture ?? ""}
            onChange={(event) =>
              update({
                prefecture: event.target.value ? (event.target.value as Prefecture) : undefined,
              })
            }
          >
            <option value="">指定なし</option>
            {prefectureValues.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={fieldLabel}>市区町村（部分一致）</span>
          <input
            type="text"
            aria-label="市区町村"
            inputMode="text"
            maxLength={80}
            className={inputBase}
            value={criteria.city ?? ""}
            onChange={(event) => update({ city: event.target.value.trim() || undefined })}
            placeholder="例: 新宿区"
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>賃料（円 / 月）</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="sr-only">賃料下限</span>
            <input
              type="number"
              aria-label="賃料下限"
              min={0}
              step={10000}
              className={inputBase}
              value={criteria.minRent ?? ""}
              onChange={(event) =>
                update({
                  minRent: event.target.value ? Number.parseInt(event.target.value, 10) : undefined,
                })
              }
              placeholder="下限"
            />
          </label>
          <label className="space-y-1">
            <span className="sr-only">賃料上限</span>
            <input
              type="number"
              aria-label="賃料上限"
              min={0}
              step={10000}
              className={inputBase}
              value={criteria.maxRent ?? ""}
              onChange={(event) =>
                update({
                  maxRent: event.target.value ? Number.parseInt(event.target.value, 10) : undefined,
                })
              }
              placeholder="上限"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>面積（㎡）</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="sr-only">面積下限</span>
            <input
              type="number"
              aria-label="面積下限"
              min={0}
              step={0.1}
              className={inputBase}
              value={criteria.minArea ?? ""}
              onChange={(event) =>
                update({
                  minArea: event.target.value ? Number.parseFloat(event.target.value) : undefined,
                })
              }
              placeholder="下限"
            />
          </label>
          <label className="space-y-1">
            <span className="sr-only">面積上限</span>
            <input
              type="number"
              aria-label="面積上限"
              min={0}
              step={0.1}
              className={inputBase}
              value={criteria.maxArea ?? ""}
              onChange={(event) =>
                update({
                  maxArea: event.target.value ? Number.parseFloat(event.target.value) : undefined,
                })
              }
              placeholder="上限"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>建物形態</legend>
        <div className="flex flex-wrap gap-2">
          {buildingTypeValues.map((value) => {
            const selected = criteria.buildingTypes.includes(value);
            return (
              <button
                type="button"
                key={value}
                onClick={() =>
                  update({
                    buildingTypes: toggleListValue<BuildingType>(criteria.buildingTypes, value),
                  })
                }
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-neutral-300 text-neutral-700 hover:border-brand-300",
                )}
              >
                {buildingTypeLabel[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>物件状態</legend>
        <div className="flex flex-wrap gap-2">
          {conditionValues.map((value) => {
            const selected = criteria.conditions.includes(value);
            return (
              <button
                type="button"
                key={value}
                onClick={() =>
                  update({
                    conditions: toggleListValue<Condition>(criteria.conditions, value),
                  })
                }
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-neutral-300 text-neutral-700 hover:border-brand-300",
                )}
              >
                {conditionLabel[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>適合業種</legend>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_CATEGORY_OPTIONS.map((option) => {
            const selected = criteria.businessCategoryRefs.includes(option.value);
            return (
              <button
                type="button"
                key={option.value}
                onClick={() =>
                  update({
                    businessCategoryRefs: toggleListValue<string>(
                      criteria.businessCategoryRefs,
                      option.value,
                    ),
                  })
                }
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-neutral-300 text-neutral-700 hover:border-brand-300",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </aside>
  );
};
