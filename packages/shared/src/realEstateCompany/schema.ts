import { z } from "zod";

/**
 * 不動産会社の宅建業免許番号。
 *
 * 形式例: 「東京都知事(3)第12345号」「国土交通大臣(1)第98765号」
 * - 知事 (都道府県) または大臣
 * - 更新回数: (N)
 * - 免許番号: 1〜6 桁の整数
 *
 * 本リポジトリはダミーデータのみを扱うが、AI 抽出の妥当性検査として
 * 形式の正しさは検証する。
 */
export const licenseNumberSchema = z
  .string()
  .min(1, "宅建業免許番号は必須です")
  .max(60)
  .regex(/^(?:[^()（）\s]{1,12}(?:知事|大臣))[(（](\d{1,3})[)）]第\d{1,6}号$/, {
    message: "宅建業免許番号の形式が不正です（例: 「東京都知事(3)第12345号」）",
  });

/**
 * 不動産会社ドキュメントスキーマ。
 *
 * spec §6.2 に対応。ロゴ画像は Sanity image asset 参照 ID で表現する。
 *
 * 注意: 本リポジトリは公開 OSS リファレンス実装のため、実在企業名・
 * 実在の連絡先・実在の宅建業免許番号を含めてはならない。
 */
export const realEstateCompanySchema = z
  .object({
    name: z.string().min(1, "会社名は必須です").max(120),
    slug: z
      .string()
      .min(1)
      .max(96)
      .regex(/^[a-z0-9-]+$/, {
        message: "slug は英小文字・数字・ハイフンのみで構成してください",
      }),
    logoAssetRef: z
      .string()
      .regex(/^image-[a-z0-9]+-\d+x\d+-[a-z0-9]+$/, {
        message: "Sanity 画像 asset 参照 ID 形式が不正です",
      })
      .optional(),
    description: z.string().max(2000).optional(),
    contactEmail: z
      .string()
      .email("contactEmail は有効なメールアドレスである必要があります")
      .max(254),
    contactPhone: z
      .string()
      .regex(/^[0-9+\-() ]{6,20}$/, {
        message: "contactPhone は数字・ハイフン・括弧・プラス・空白のみで構成してください",
      })
      .optional(),
    licenseNumber: licenseNumberSchema,
    representativeName: z.string().min(1, "代表者名は必須です").max(60),
    websiteUrl: z.string().url().optional(),
  })
  .strict();

export type RealEstateCompany = z.infer<typeof realEstateCompanySchema>;
