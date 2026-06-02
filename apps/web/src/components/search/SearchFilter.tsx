"use client";

import {
  type BuildingType,
  buildingTypeValues,
  type Condition,
  conditionValues,
  type Prefecture,
  prefectureValues,
} from "@oceans-tenant/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useTransition } from "react";
import { cn } from "@/lib/cn";
import { useEnumLabelLookup } from "@/lib/i18n/enum-labels";
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

/**
 * 業種カテゴリ ref → 翻訳キー suffix のマップ。
 *
 * `search.businessCategory.<suffix>` から locale 別ラベルを引く。
 * Sanity 移行後に schema 側へ寄せる可能性があるため、ここでは小さな定数として局所保持する。
 */
const BUSINESS_CATEGORY_OPTION_REFS: ReadonlyArray<{ value: string; labelKey: string }> = [
  { value: "category-cafe", labelKey: "cafe" },
  { value: "category-restaurant", labelKey: "restaurant" },
  { value: "category-bar", labelKey: "bar" },
  { value: "category-retail", labelKey: "retail" },
  { value: "category-beauty", labelKey: "beauty" },
  { value: "category-office", labelKey: "office" },
  { value: "category-fitness", labelKey: "fitness" },
  { value: "category-clinic", labelKey: "clinic" },
];

export const SearchFilter = ({
  className,
  initialCriteria,
}: SearchFilterProps): React.JSX.Element => {
  const tFilter = useTranslations("search.filter");
  const tCategory = useTranslations("search.businessCategory");
  const enumLabels = useEnumLabelLookup();
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

  // フィルタ変更時はページを 1 に戻す（2 ページ目で条件を変えたら表示が無になる事故を防ぐ）。
  const update = (partial: Partial<SearchCriteria>) => {
    apply({ ...criteria, ...partial, page: 1 });
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
      aria-label={tFilter("ariaLabel")}
      data-pending={isPending ? "true" : "false"}
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">{tFilter("heading")}</h2>
        <button
          type="button"
          onClick={() => apply(EMPTY_CRITERIA)}
          className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
          disabled={isPending}
        >
          {tFilter("clear")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={fieldLabel}>{tFilter("prefecture")}</span>
          <select
            aria-label={tFilter("prefecture")}
            className={inputBase}
            value={criteria.prefecture ?? ""}
            onChange={(event) =>
              update({
                prefecture: event.target.value ? (event.target.value as Prefecture) : undefined,
              })
            }
          >
            <option value="">{tFilter("prefecturePlaceholder")}</option>
            {prefectureValues.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={fieldLabel}>{tFilter("city")}</span>
          <input
            type="text"
            aria-label={tFilter("cityAriaLabel")}
            inputMode="text"
            maxLength={80}
            className={inputBase}
            value={criteria.city ?? ""}
            onChange={(event) => update({ city: event.target.value.trim() || undefined })}
            placeholder={tFilter("cityPlaceholder")}
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>{tFilter("rentLegend")}</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="sr-only">{tFilter("rentMinAriaLabel")}</span>
            <input
              type="number"
              aria-label={tFilter("rentMinAriaLabel")}
              min={0}
              step={10000}
              className={inputBase}
              value={criteria.minRent ?? ""}
              onChange={(event) =>
                update({
                  minRent: event.target.value ? Number.parseInt(event.target.value, 10) : undefined,
                })
              }
              placeholder={tFilter("rentMinPlaceholder")}
            />
          </label>
          <label className="space-y-1">
            <span className="sr-only">{tFilter("rentMaxAriaLabel")}</span>
            <input
              type="number"
              aria-label={tFilter("rentMaxAriaLabel")}
              min={0}
              step={10000}
              className={inputBase}
              value={criteria.maxRent ?? ""}
              onChange={(event) =>
                update({
                  maxRent: event.target.value ? Number.parseInt(event.target.value, 10) : undefined,
                })
              }
              placeholder={tFilter("rentMaxPlaceholder")}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>{tFilter("areaLegend")}</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="sr-only">{tFilter("areaMinAriaLabel")}</span>
            <input
              type="number"
              aria-label={tFilter("areaMinAriaLabel")}
              min={0}
              step={0.1}
              className={inputBase}
              value={criteria.minArea ?? ""}
              onChange={(event) =>
                update({
                  minArea: event.target.value ? Number.parseFloat(event.target.value) : undefined,
                })
              }
              placeholder={tFilter("areaMinPlaceholder")}
            />
          </label>
          <label className="space-y-1">
            <span className="sr-only">{tFilter("areaMaxAriaLabel")}</span>
            <input
              type="number"
              aria-label={tFilter("areaMaxAriaLabel")}
              min={0}
              step={0.1}
              className={inputBase}
              value={criteria.maxArea ?? ""}
              onChange={(event) =>
                update({
                  maxArea: event.target.value ? Number.parseFloat(event.target.value) : undefined,
                })
              }
              placeholder={tFilter("areaMaxPlaceholder")}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>{tFilter("buildingTypeLegend")}</legend>
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
                {enumLabels.buildingType(value)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>{tFilter("conditionLegend")}</legend>
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
                {enumLabels.condition(value)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>{tFilter("businessCategoryLegend")}</legend>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_CATEGORY_OPTION_REFS.map((option) => {
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
                {tCategory(option.labelKey)}
              </button>
            );
          })}
        </div>
      </fieldset>
    </aside>
  );
};
