import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAdminEnabled } from "@/lib/admin/feature-flag";
import { deleteProperty, upsertProperty } from "@/lib/admin/mutations";

/**
 * Admin 物件 mutation API。
 *
 * - POST: 物件を upsert（新規・編集兼用）。body は `propertySchema` 形状の JSON
 * - DELETE: 物件を削除。`?slug=xxx` クエリ、または body の `{ slug }` を許容
 *
 * 設計判断:
 * - **feature flag を route ハンドラ冒頭で再検証**: middleware の matcher は `/api` を除外しているため、
 *   API も自前で `isAdminEnabled()` を判定し、無効時は 404 を返す。
 * - **Zod 検証エラーは 400**: `ZodError` を catch して `flatten()` の `fieldErrors` を返す。
 *   それ以外の例外は 500 で `message` のみ返す。
 * - 認証なし demo 前提。CSRF 対策やレート制限は別 PR。
 */

const buildDisabledResponse = (): NextResponse =>
  NextResponse.json({ status: "error", error: "Admin is disabled" }, { status: 404 });

const parseJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch (_error) {
    return null;
  }
};

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!isAdminEnabled()) {
    return buildDisabledResponse();
  }
  const body = await parseJsonBody(request);
  if (body === null) {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const result = await upsertProperty(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          status: "error",
          error: "Validation failed",
          fieldErrors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
};

const extractSlug = (request: Request, body: unknown): string | null => {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("slug");
  if (fromQuery) return fromQuery;
  if (body && typeof body === "object" && "slug" in body) {
    const value = (body as { slug: unknown }).slug;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
};

export const DELETE = async (request: Request): Promise<NextResponse> => {
  if (!isAdminEnabled()) {
    return buildDisabledResponse();
  }
  const body = await parseJsonBody(request);
  const slug = extractSlug(request, body);
  if (!slug) {
    return NextResponse.json({ status: "error", error: "slug is required" }, { status: 400 });
  }
  try {
    const result = await deleteProperty(slug);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
};
