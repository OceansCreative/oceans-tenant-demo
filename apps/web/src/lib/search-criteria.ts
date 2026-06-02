import {
  type BuildingType,
  buildingTypeValues,
  type Condition,
  conditionValues,
  type Prefecture,
  prefectureValues,
  type SearchCriteria as SharedSearchCriteria,
} from "@oceans-tenant/shared";

/**
 * URL クエリと同期する検索条件の正規化レイヤ。
 *
 * - URLSearchParams ↔ SearchCriteria の双方向変換
 * - 不正値は黙って除外（壊れた URL を踏んでも安全に動作）
 * - Server Component / Client Component の両方から参照される pure 関数群
 *
 * 型本体は `@oceans-tenant/shared` の `searchCriteriaSchema` から推論された
 * `SharedSearchCriteria` を再エクスポートする。これにより API レイヤと URL
 * レイヤが同じ型を共有し、Claude 出力経路にも同一の検証が効く。
 */

export type SearchCriteria = SharedSearchCriteria;

const PREFECTURE_SET = new Set<string>(prefectureValues);
const BUILDING_TYPE_SET = new Set<string>(buildingTypeValues);
const CONDITION_SET = new Set<string>(conditionValues);

const parseInteger = (value: string | null, min = 0): number | undefined => {
  if (value === null || value === "") return undefined;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num < min) return undefined;
  return num;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE = 1;
const MAX_PAGE = 10000;
const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const parseIntegerInRange = (
  value: string | null,
  min: number,
  max: number,
  fallback: number,
): number => {
  if (value === null || value === "") return fallback;
  const num = Number.parseInt(value, 10);
  if (!Number.isInteger(num) || num < min || num > max) return fallback;
  return num;
};

const parsePositiveNumber = (value: string | null): number | undefined => {
  if (value === null || value === "") return undefined;
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num;
};

const parseStringEnum = <T extends string>(
  value: string | null,
  validSet: Set<string>,
): T | undefined => {
  if (value === null || value === "") return undefined;
  return validSet.has(value) ? (value as T) : undefined;
};

const parseStringList = (
  values: ReadonlyArray<string>,
  validSet: Set<string>,
): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (validSet.has(value) && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
};

const parseFreeStringList = (
  values: ReadonlyArray<string>,
  pattern: RegExp,
): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (pattern.test(value) && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
};

const REF_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const CITY_PATTERN = /^[\p{L}\p{N}\p{S}\p{P}\s]{1,80}$/u;

export const parseSearchCriteria = (params: URLSearchParams): SearchCriteria => {
  const minRent = parseInteger(params.get("minRent"));
  const maxRent = parseInteger(params.get("maxRent"));
  const minArea = parsePositiveNumber(params.get("minArea"));
  const maxArea = parsePositiveNumber(params.get("maxArea"));
  const cityRaw = params.get("city")?.trim() ?? "";
  const city = cityRaw && CITY_PATTERN.test(cityRaw) ? cityRaw : undefined;
  const q = params.get("q")?.trim() || undefined;
  return {
    prefecture: parseStringEnum<Prefecture>(params.get("prefecture"), PREFECTURE_SET),
    city,
    minRent,
    maxRent:
      maxRent !== undefined && minRent !== undefined && maxRent < minRent ? undefined : maxRent,
    minArea,
    maxArea:
      maxArea !== undefined && minArea !== undefined && maxArea < minArea ? undefined : maxArea,
    buildingTypes: parseStringList(
      params.getAll("buildingType"),
      BUILDING_TYPE_SET,
    ) as ReadonlyArray<BuildingType>,
    conditions: parseStringList(
      params.getAll("condition"),
      CONDITION_SET,
    ) as ReadonlyArray<Condition>,
    businessCategoryRefs: parseFreeStringList(params.getAll("biz"), REF_PATTERN),
    q,
    page: parseIntegerInRange(params.get("page"), MIN_PAGE, MAX_PAGE, DEFAULT_PAGE),
    pageSize: parseIntegerInRange(
      params.get("pageSize"),
      MIN_PAGE_SIZE,
      MAX_PAGE_SIZE,
      DEFAULT_PAGE_SIZE,
    ),
  };
};

export const serializeSearchCriteria = (criteria: SearchCriteria): URLSearchParams => {
  const params = new URLSearchParams();
  if (criteria.prefecture) params.set("prefecture", criteria.prefecture);
  if (criteria.city) params.set("city", criteria.city);
  if (criteria.minRent !== undefined) params.set("minRent", String(criteria.minRent));
  if (criteria.maxRent !== undefined) params.set("maxRent", String(criteria.maxRent));
  if (criteria.minArea !== undefined) params.set("minArea", String(criteria.minArea));
  if (criteria.maxArea !== undefined) params.set("maxArea", String(criteria.maxArea));
  for (const value of criteria.buildingTypes) params.append("buildingType", value);
  for (const value of criteria.conditions) params.append("condition", value);
  for (const value of criteria.businessCategoryRefs) params.append("biz", value);
  if (criteria.q) params.set("q", criteria.q);
  // page=1 / pageSize=20 はデフォルトなので URL から省く（共有 URL を短く保つ）。
  if (criteria.page !== DEFAULT_PAGE) params.set("page", String(criteria.page));
  if (criteria.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(criteria.pageSize));
  return params;
};

export const EMPTY_CRITERIA: SearchCriteria = {
  buildingTypes: [],
  conditions: [],
  businessCategoryRefs: [],
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const isEmptyCriteria = (criteria: SearchCriteria): boolean =>
  serializeSearchCriteria(criteria).toString() === "";
