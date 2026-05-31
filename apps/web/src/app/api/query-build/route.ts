import { searchCriteriaSchema } from "@oceans-tenant/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPropertyGroq, GroqInjectionError } from "@/lib/ai/prompts/query-build";

export const runtime = "nodejs";

/**
 * 構造化条件 → GROQ クエリの内部 API。
 *
 * Claude を介さない決定論的な変換を行い、AI レイヤから安全に呼び出せるようにする。
 * ホワイトリスト方式は `@oceans-tenant/shared` の `searchCriteriaSchema` に集約し、
 * 同じ検証ロジックを `/api/chat-search`（AI 抽出経路）でも再利用する。
 */

const RequestSchema = z.object({
  criteria: searchCriteriaSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

export const POST = async (request: Request): Promise<NextResponse> => {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body = (await request.json()) as unknown;
    parsed = RequestSchema.parse(body);
  } catch (error) {
    console.error("[query-build] リクエスト形式不正", error);
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }
  try {
    const result = buildPropertyGroq(parsed.criteria, parsed.limit ?? 60);
    return NextResponse.json({
      groq: result.groq,
      params: result.params,
    });
  } catch (error) {
    if (error instanceof GroqInjectionError) {
      console.error("[query-build] GROQ injection", error.message);
      return NextResponse.json({ error: "条件が不正です" }, { status: 400 });
    }
    console.error("[query-build] unexpected", error);
    return NextResponse.json({ error: "GROQ 生成に失敗しました" }, { status: 500 });
  }
};
