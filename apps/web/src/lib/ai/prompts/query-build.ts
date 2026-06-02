import type { SearchCriteria } from "@/lib/search-criteria";

/**
 * 構造化された SearchCriteria から Sanity GROQ を組み立てるための
 * プロンプト群（実際の GROQ 構築は決定論的なロジックで行う）。
 *
 * AI を介さない代わりに、ホワイトリスト方式で許可フィールドだけを
 * GROQ に変換することでインジェクションを完全に排除する。
 */

const ALLOWED_PREFECTURE_PATTERN = /^[\p{L}\p{N}\s]+$/u;
const ALLOWED_REF_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export class GroqInjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroqInjectionError";
  }
}

export type BuildGroqResult = {
  readonly groq: string;
  readonly params: Record<string, string | number | ReadonlyArray<string>>;
};

const escapeString = (value: string): string => value.replace(/["'\\]/g, "");

const sanitizeRef = (value: string): string => {
  if (!ALLOWED_REF_PATTERN.test(value)) {
    throw new GroqInjectionError(`不正な reference ID: ${value}`);
  }
  return value;
};

const sanitizeText = (value: string, maxLength = 80): string => {
  if (value.length > maxLength) {
    throw new GroqInjectionError(`値が長すぎます: ${value.slice(0, 20)}…`);
  }
  return escapeString(value);
};

/**
 * SearchCriteria から決定論的に GROQ を組み立てる。
 *
 * 全フィールドをホワイトリストで検査し、不正な値は GroqInjectionError を投げる。
 *
 * `limit` を省略した場合は `criteria.pageSize` を、`offset` を省略した場合は
 * `(criteria.page - 1) * criteria.pageSize` を採用する。GROQ には `[$offset...$offset + $limit]`
 * で出力するため、Phase 3 で Sanity に切り替えても同じプロンプトで動く。
 */
export const buildPropertyGroq = (
  criteria: SearchCriteria,
  limit?: number,
  offset?: number,
): BuildGroqResult => {
  const filters: string[] = ['_type == "property"'];
  const params: Record<string, string | number | ReadonlyArray<string>> = {};

  if (criteria.prefecture) {
    if (!ALLOWED_PREFECTURE_PATTERN.test(criteria.prefecture)) {
      throw new GroqInjectionError(`不正な都道府県: ${criteria.prefecture}`);
    }
    params.prefecture = criteria.prefecture;
    filters.push("address.prefecture == $prefecture");
  }

  if (criteria.city) {
    params.city = sanitizeText(criteria.city);
    filters.push("address.city match $city + '*'");
  }

  if (criteria.minRent !== undefined) {
    if (!Number.isInteger(criteria.minRent) || criteria.minRent < 0) {
      throw new GroqInjectionError("minRent は 0 以上の整数");
    }
    params.minRent = criteria.minRent;
    filters.push("rent >= $minRent");
  }

  if (criteria.maxRent !== undefined) {
    if (!Number.isInteger(criteria.maxRent) || criteria.maxRent < 0) {
      throw new GroqInjectionError("maxRent は 0 以上の整数");
    }
    params.maxRent = criteria.maxRent;
    filters.push("rent <= $maxRent");
  }

  if (criteria.minArea !== undefined) {
    if (!Number.isFinite(criteria.minArea) || criteria.minArea <= 0) {
      throw new GroqInjectionError("minArea は正の数");
    }
    params.minArea = criteria.minArea;
    filters.push("area >= $minArea");
  }

  if (criteria.maxArea !== undefined) {
    if (!Number.isFinite(criteria.maxArea) || criteria.maxArea <= 0) {
      throw new GroqInjectionError("maxArea は正の数");
    }
    params.maxArea = criteria.maxArea;
    filters.push("area <= $maxArea");
  }

  if (criteria.buildingTypes.length > 0) {
    params.buildingTypes = criteria.buildingTypes;
    filters.push("buildingType in $buildingTypes");
  }
  if (criteria.conditions.length > 0) {
    params.conditions = criteria.conditions;
    filters.push("condition in $conditions");
  }
  if (criteria.businessCategoryRefs.length > 0) {
    params.businessRefs = criteria.businessCategoryRefs.map(sanitizeRef);
    filters.push("count(suitableBusinesses[@._ref in $businessRefs]) > 0");
  }
  if (criteria.q) {
    params.q = sanitizeText(criteria.q, 100);
    filters.push("[title, description, pt::text(description)] match $q + '*'");
  }
  const resolvedLimit = limit ?? criteria.pageSize;
  const resolvedOffset = offset ?? (criteria.page - 1) * criteria.pageSize;
  if (!Number.isInteger(resolvedLimit) || resolvedLimit < 1 || resolvedLimit > 200) {
    throw new GroqInjectionError("limit は 1〜200 の整数");
  }
  if (!Number.isInteger(resolvedOffset) || resolvedOffset < 0 || resolvedOffset > 1_000_000) {
    throw new GroqInjectionError("offset は 0〜1000000 の整数");
  }
  params.limit = resolvedLimit;
  params.offset = resolvedOffset;

  const filterString = filters.join(" && ");
  // 注意: tsubo を GROQ で計算しない。坪数換算は packages/shared の squareMeterToTsubo を
  // 単一の真実とし、フロント側で derivePropertyTsubo(property) を通す（Issue #87）。
  // GROQ で `area * 0.3025` を直接出すと丸めが効かず JS 側の Math.round 結果と食い違う。
  // また、Sanity → shared Zod の橋渡しのため aiMeta / *Refs を projection で吸収する（Issue #86）。
  // [$offset...$offset + $limit] で page-based pagination を実現する。
  const groq = `*[${filterString}] | order(publishedAt desc) [$offset...$offset + $limit]{
  _id,
  title,
  slug,
  address,
  nearestStations,
  rent,
  commonFee,
  depositMonths,
  keyMoneyMonths,
  area,
  floor,
  buildingType,
  condition,
  previousBusiness,
  description,
  features,
  availability,
  publishedAt,
  "suitableBusinessRefs": suitableBusinesses[]._ref,
  "listedByRef": listedBy._ref,
  "aiMeta": {
    "aiExtracted": aiExtracted,
    "aiConfidence": aiConfidence,
    "sourceUrl": sourceUrl
  }
}`;

  return { groq, params };
};
