import { z } from "zod";
import { type Prefecture, prefectureValues } from "../property/address.js";
import {
  type BuildingType,
  buildingTypeValues,
  type Condition,
  conditionValues,
} from "../property/enums.js";

/**
 * 検索条件の Zod スキーマ。
 *
 * `/api/query-build`（構造化条件 → GROQ）と `/api/chat-search`（Claude の
 * 抽出条件出力）の両方から共通で使う。AI 出力経路でも必ず `safeParse` を
 * 通すことで、列挙値違反や型ズレが GROQ レイヤに到達しないことを保証する。
 */

const REF_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export const searchCriteriaSchema = z
  .object({
    prefecture: z.enum(prefectureValues).optional(),
    city: z.string().min(1).max(80).optional(),
    minRent: z.number().int().min(0).optional(),
    maxRent: z.number().int().min(0).optional(),
    minArea: z.number().positive().optional(),
    maxArea: z.number().positive().optional(),
    buildingTypes: z.array(z.enum(buildingTypeValues)).max(10).default([]),
    conditions: z.array(z.enum(conditionValues)).max(10).default([]),
    businessCategoryRefs: z
      .array(z.string().regex(REF_PATTERN, "businessCategoryRefs の形式が不正です"))
      .max(20)
      .default([]),
    q: z.string().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.minRent !== undefined &&
      value.maxRent !== undefined &&
      value.minRent > value.maxRent
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minRent は maxRent 以下である必要があります",
        path: ["minRent"],
      });
    }
    if (
      value.minArea !== undefined &&
      value.maxArea !== undefined &&
      value.minArea > value.maxArea
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minArea は maxArea 以下である必要があります",
        path: ["minArea"],
      });
    }
  });

/**
 * Zod の `z.infer` は配列を mutable `T[]` として推論するが、
 * web 側は immutable な使い回しを前提に `ReadonlyArray` を採用しているため、
 * ここで `Readonly` 化したエクスポート型を定義する（実体は同じ）。
 */
type ParsedSearchCriteria = z.infer<typeof searchCriteriaSchema>;

export type SearchCriteria = {
  readonly [K in keyof ParsedSearchCriteria]: ParsedSearchCriteria[K] extends ReadonlyArray<infer U>
    ? ReadonlyArray<U>
    : ParsedSearchCriteria[K];
};

export const EMPTY_SEARCH_CRITERIA: SearchCriteria = {
  buildingTypes: [],
  conditions: [],
  businessCategoryRefs: [],
};

export type SearchCriteriaInput = z.input<typeof searchCriteriaSchema>;

export type {
  BuildingType as SearchCriteriaBuildingType,
  Condition as SearchCriteriaCondition,
  Prefecture as SearchCriteriaPrefecture,
};
