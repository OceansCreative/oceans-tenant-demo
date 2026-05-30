import { z } from "zod";
import { geopointSchema, prefectureSchema } from "../property/address.js";

/**
 * エリアドキュメントスキーマ。
 *
 * spec §6.4 に対応。検索ファセット用のエリア定義（例: 東京 > 新宿区 > 西新宿）を
 * 表現する。`coordinates` は中心座標で、Sanity の地図表示の起点に使う。
 *
 * - 都道府県は @oceans-tenant/shared の prefectureSchema を再利用
 * - 市区町村は必須
 * - 細分エリア（"西新宿" など）は任意
 * - parentAreaRef は親エリアへの参照でツリー構造を表現
 */
export const areaSchema = z
  .object({
    name: z.string().min(1, "エリア名は必須です").max(60),
    slug: z
      .string()
      .min(1)
      .max(96)
      .regex(/^[a-z0-9-]+$/, {
        message: "slug は英小文字・数字・ハイフンのみで構成してください",
      }),
    prefecture: prefectureSchema,
    city: z.string().min(1, "市区町村は必須です").max(80),
    district: z.string().max(80).optional(),
    coordinates: geopointSchema,
    parentAreaRef: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: "parentAreaRef は英数字・アンダースコア・ハイフンのみ",
      })
      .optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export type Area = z.infer<typeof areaSchema>;
