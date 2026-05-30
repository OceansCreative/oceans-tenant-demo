import { z } from "zod";

/**
 * 業種カテゴリのアイコン種別。
 *
 * Sanity 側では string で管理し、UI 側でアイコンマップに変換する。
 * 未知の値も受け入れるが、ホワイトリストの定数も export して
 * type guard やデフォルト UI 用に使えるようにする。
 */
export const businessCategoryIconValues = [
  "cafe",
  "restaurant",
  "bar",
  "retail",
  "beauty",
  "office",
  "fitness",
  "clinic",
  "other",
] as const;
export const businessCategoryIconSchema = z.enum(businessCategoryIconValues);
export type BusinessCategoryIcon = z.infer<typeof businessCategoryIconSchema>;

export const businessCategoryIconLabel: Readonly<Record<BusinessCategoryIcon, string>> = {
  cafe: "カフェ",
  restaurant: "レストラン / 飲食店",
  bar: "バー / 居酒屋",
  retail: "物販 / 小売",
  beauty: "美容 / サロン",
  office: "オフィス",
  fitness: "フィットネス",
  clinic: "クリニック",
  other: "その他",
};

/**
 * 業種カテゴリドキュメントスキーマ。
 *
 * spec §6.3 に対応。`parentRef` は自身と同じ businessCategory への参照で、
 * カテゴリツリーを表現する（例: 飲食 > カフェ > 個人経営カフェ）。
 *
 * 循環参照の防止は Sanity 側の手動運用に委ねる（Zod レベルでは検査不可）。
 */
export const businessCategorySchema = z
  .object({
    name: z.string().min(1, "カテゴリ名は必須です").max(60),
    slug: z
      .string()
      .min(1)
      .max(96)
      .regex(/^[a-z0-9-]+$/, {
        message: "slug は英小文字・数字・ハイフンのみで構成してください",
      }),
    parentRef: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: "parentRef は英数字・アンダースコア・ハイフンのみ",
      })
      .optional(),
    icon: businessCategoryIconSchema.optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int("sortOrder は整数で指定してください").min(0).max(9999).optional(),
  })
  .strict();

export type BusinessCategory = z.infer<typeof businessCategorySchema>;
