import { z } from "zod";
import { squareMeterToTsubo } from "../tsubo.js";
import { addressSchema, nearestStationSchema } from "./address.js";
import { availabilitySchema, buildingTypeSchema, conditionSchema } from "./enums.js";

/**
 * Sanity の asset 参照（画像）。
 * リポジトリ層では参照 ID と alt のみを保持する。
 */
export const propertyImageSchema = z
  .object({
    assetRef: z.string().regex(/^image-[a-z0-9]+-\d+x\d+-[a-z0-9]+$/, {
      message: "Sanity 画像 asset 参照 ID 形式が不正です",
    }),
    alt: z.string().max(200).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export type PropertyImage = z.infer<typeof propertyImageSchema>;

/**
 * AI による抽出メタ情報。
 *
 * - sourceUrl: 抽出元の物件掲載ページ URL（http/https のみ）
 * - aiExtracted: true なら AI 抽出、false なら手動入力
 * - aiConfidence: 0〜1 の信頼度
 */
export const aiExtractionMetaSchema = z
  .object({
    sourceUrl: z.string().url().optional(),
    aiExtracted: z.boolean(),
    aiConfidence: z
      .number()
      .min(0, "aiConfidence は 0 以上である必要があります")
      .max(1, "aiConfidence は 1 以下である必要があります")
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.aiExtracted && value.aiConfidence === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AI 抽出された場合 aiConfidence は必須です",
        path: ["aiConfidence"],
      });
    }
    if (!value.aiExtracted && value.aiConfidence !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AI 抽出でない場合 aiConfidence は指定できません",
        path: ["aiConfidence"],
      });
    }
  });

export type AiExtractionMeta = z.infer<typeof aiExtractionMetaSchema>;

/**
 * 店舗物件のドキュメントスキーマ。
 *
 * spec §6.1 に対応。Sanity 側の document 定義と 1:1 でフィールドを揃え、
 * API レイヤ（API Route, AI 抽出, GROQ 生成）で共通の validator として使う。
 *
 * 坪数は ㎡ から自動計算するため、入力 schema では `tsubo` を許可しない。
 * `derivePropertyTsubo` を使って計算済み値を含む `PropertyWithTsubo` を得る。
 */
export const propertySchema = z
  .object({
    title: z.string().min(1, "title は必須です").max(120),
    slug: z
      .string()
      .min(1)
      .max(96)
      .regex(/^[a-z0-9-]+$/, {
        message: "slug は英小文字・数字・ハイフンのみで構成してください",
      }),
    address: addressSchema,
    nearestStations: z.array(nearestStationSchema).max(5).default([]),
    rent: z
      .number()
      .int("rent は整数で指定してください")
      .min(0, "rent は 0 以上である必要があります"),
    commonFee: z.number().int().min(0).optional(),
    depositMonths: z.number().min(0).max(24).optional(),
    keyMoneyMonths: z.number().min(0).max(24).optional(),
    area: z
      .number()
      .positive("area は正の数である必要があります")
      .max(10000, "area が 10,000 ㎡ を超えています"),
    floor: z.string().max(40).optional(),
    buildingType: buildingTypeSchema.optional(),
    condition: conditionSchema.optional(),
    previousBusiness: z.string().max(120).optional(),
    suitableBusinessRefs: z
      .array(z.string().regex(/^[a-zA-Z0-9_-]+$/))
      .max(20)
      .default([]),
    images: z.array(propertyImageSchema).max(30).default([]),
    description: z.string().max(4000).optional(),
    features: z.array(z.string().min(1).max(40)).max(20).default([]),
    availability: availabilitySchema,
    listedByRef: z
      .string()
      .min(1, "listedByRef は必須です")
      .regex(/^[a-zA-Z0-9_-]+$/),
    aiMeta: aiExtractionMetaSchema,
    publishedAt: z
      .string()
      .datetime({ message: "publishedAt は ISO 8601 形式である必要があります" }),
  })
  .strict();

export type Property = z.infer<typeof propertySchema>;

/**
 * 坪数を自動計算した派生型。
 */
export type PropertyWithTsubo = Property & {
  readonly tsubo: number;
};

export const derivePropertyTsubo = (property: Property): PropertyWithTsubo => ({
  ...property,
  tsubo: squareMeterToTsubo(property.area),
});
