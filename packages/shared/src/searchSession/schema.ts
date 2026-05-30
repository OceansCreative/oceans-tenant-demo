import { z } from "zod";

/**
 * 対話型検索のチャットメッセージ。
 * - role: ユーザー発話 / アシスタント発話 / システム指示
 * - content: 発話内容
 * - createdAt: ISO 8601 形式の生成時刻
 */
export const chatMessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;

export const chatMessageSchema = z
  .object({
    role: chatMessageRoleSchema,
    content: z.string().min(1, "メッセージ内容は必須です").max(4000),
    createdAt: z.string().datetime({ message: "createdAt は ISO 8601 形式である必要があります" }),
  })
  .strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * AI が会話から抽出した検索条件。
 *
 * 値は段階的に充足されるため、すべて任意。
 */
export const extractedSearchCriteriaSchema = z
  .object({
    prefectures: z.array(z.string().min(1).max(20)).max(47).optional(),
    cities: z.array(z.string().min(1).max(80)).max(20).optional(),
    minRent: z.number().int().min(0).optional(),
    maxRent: z.number().int().min(0).optional(),
    minArea: z.number().positive().optional(),
    maxArea: z.number().positive().optional(),
    buildingTypes: z.array(z.string().min(1)).max(10).optional(),
    conditions: z.array(z.string().min(1)).max(10).optional(),
    businessCategoryRefs: z
      .array(z.string().regex(/^[a-zA-Z0-9_-]+$/))
      .max(20)
      .optional(),
    features: z.array(z.string().min(1).max(40)).max(20).optional(),
    freeText: z.string().max(2000).optional(),
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

export type ExtractedSearchCriteria = z.infer<typeof extractedSearchCriteriaSchema>;

/**
 * 検索セッションドキュメントスキーマ。
 *
 * spec §6.5 に対応。AI 対話の履歴と最終的な検索条件、ヒット結果を 1 ドキュメントに集約。
 *
 * - sessionId: クライアント生成の UUID v4
 * - messages: 時系列のチャット
 * - extractedCriteria: AI が抽出した検索条件
 * - resultPropertyRefs: 最終的にヒットした property 参照 ID
 * - createdAt / updatedAt: ISO 8601
 */
export const sessionIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, {
    message: "sessionId は UUID v4 形式である必要があります",
  });

export const searchSessionSchema = z
  .object({
    sessionId: sessionIdSchema,
    messages: z
      .array(chatMessageSchema)
      .max(100, "messages は 100 件以下である必要があります")
      .default([]),
    extractedCriteria: extractedSearchCriteriaSchema.optional(),
    resultPropertyRefs: z
      .array(z.string().regex(/^[a-zA-Z0-9_-]+$/))
      .max(200)
      .default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.updatedAt) < new Date(value.createdAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "updatedAt は createdAt 以降である必要があります",
        path: ["updatedAt"],
      });
    }
  });

export type SearchSession = z.infer<typeof searchSessionSchema>;
