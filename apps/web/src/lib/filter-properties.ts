import type { PropertyWithTsubo } from "@oceans-tenant/shared";
import type { SearchCriteria } from "./search-criteria";

/**
 * `filterProperties` の戻り値型。
 *
 * `items` はページサイズ分にスライスした結果、`totalCount` はスライス前の全件数。
 * ページネーション UI で「N 件中 i 〜 j 件目」を出すために双方が必要。
 */
export type FilteredProperties = {
  readonly items: ReadonlyArray<PropertyWithTsubo>;
  readonly totalCount: number;
};

/**
 * メモリ上の物件配列に対して検索条件を適用するフィルタ。
 * Phase 3 で Sanity GROQ に置き換える前提で、関心の分離だけ確保する。
 *
 * 検索結果は `criteria.page` / `criteria.pageSize` に基づいてスライスし、
 * スライス前の全件数を `totalCount` として返す。
 */
export const filterProperties = (
  properties: ReadonlyArray<PropertyWithTsubo>,
  criteria: SearchCriteria,
): FilteredProperties => {
  const filtered = properties.filter((property) => {
    if (criteria.prefecture && property.address.prefecture !== criteria.prefecture) {
      return false;
    }
    if (criteria.city && !property.address.city.includes(criteria.city)) {
      return false;
    }
    if (criteria.minRent !== undefined && property.rent < criteria.minRent) return false;
    if (criteria.maxRent !== undefined && property.rent > criteria.maxRent) return false;
    if (criteria.minArea !== undefined && property.area < criteria.minArea) return false;
    if (criteria.maxArea !== undefined && property.area > criteria.maxArea) return false;
    if (criteria.buildingTypes.length > 0) {
      if (!property.buildingType || !criteria.buildingTypes.includes(property.buildingType)) {
        return false;
      }
    }
    if (criteria.conditions.length > 0) {
      if (!property.condition || !criteria.conditions.includes(property.condition)) {
        return false;
      }
    }
    if (criteria.businessCategoryRefs.length > 0) {
      const matched = criteria.businessCategoryRefs.some((ref) =>
        property.suitableBusinessRefs.includes(ref),
      );
      if (!matched) return false;
    }
    if (criteria.q) {
      const haystack = [
        property.title,
        property.description ?? "",
        property.features.join(" "),
        property.address.prefecture,
        property.address.city,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(criteria.q.toLowerCase())) return false;
    }
    return true;
  });
  const start = (criteria.page - 1) * criteria.pageSize;
  const items = filtered.slice(start, start + criteria.pageSize);
  return { items, totalCount: filtered.length };
};
