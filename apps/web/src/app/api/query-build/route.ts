import { buildingTypeValues, conditionValues, prefectureValues } from "@oceans-tenant/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPropertyGroq, GroqInjectionError } from "@/lib/ai/prompts/query-build";
import type { SearchCriteria } from "@/lib/search-criteria";

export const runtime = "nodejs";

/**
 * 構造化条件 → GROQ クエリの内部 API。
 *
 * Claude を介さない決定論的な変換を行い、AI レイヤから安全に呼び出せるようにする。
 * ホワイトリスト方式で許可フィールドのみ受け入れ、不正値は GroqInjectionError → 400。
 */

const PREFECTURES = new Set<string>(prefectureValues);
const BUILDING_TYPES = new Set<string>(buildingTypeValues);
const CONDITIONS = new Set<string>(conditionValues);

const CriteriaSchema = z.object({
  prefecture: z
    .string()
    .refine((v) => PREFECTURES.has(v), { message: "不正な都道府県" })
    .optional(),
  city: z.string().max(80).optional(),
  minRent: z.number().int().min(0).optional(),
  maxRent: z.number().int().min(0).optional(),
  minArea: z.number().positive().optional(),
  maxArea: z.number().positive().optional(),
  buildingTypes: z
    .array(z.string().refine((v) => BUILDING_TYPES.has(v), { message: "不正な建物形態" }))
    .max(10)
    .default([]),
  conditions: z
    .array(z.string().refine((v) => CONDITIONS.has(v), { message: "不正な物件状態" }))
    .max(10)
    .default([]),
  businessCategoryRefs: z.array(z.string()).max(20).default([]),
  q: z.string().max(200).optional(),
});

const RequestSchema = z.object({
  criteria: CriteriaSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

export const POST = async (request: Request): Promise<NextResponse> => {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body = (await request.json()) as unknown;
    parsed = RequestSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      {
        error: "リクエスト形式が不正です",
        details: error instanceof Error ? error.message : error,
      },
      { status: 400 },
    );
  }
  try {
    const criteria = parsed.criteria as unknown as SearchCriteria;
    const result = buildPropertyGroq(criteria, parsed.limit ?? 60);
    return NextResponse.json({
      groq: result.groq,
      params: result.params,
    });
  } catch (error) {
    if (error instanceof GroqInjectionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "GROQ 生成に失敗しました" }, { status: 500 });
  }
};
