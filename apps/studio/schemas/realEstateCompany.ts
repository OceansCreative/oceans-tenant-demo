import { defineField, defineType } from "sanity";

/**
 * 不動産会社ドキュメントタイプ。
 *
 * spec §6.2 に対応。property.listedBy から参照される。
 *
 * 注意: 公開 OSS リファレンス実装のため、実在企業名・実在連絡先・
 * 実在の宅建業免許番号を Studio に入力してはならない。
 */
export const realEstateCompanyType = defineType({
  name: "realEstateCompany",
  title: "不動産会社",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "会社名",
      type: "string",
      validation: (rule) => rule.required().min(1).max(120),
    }),
    defineField({
      name: "slug",
      title: "スラッグ",
      type: "slug",
      options: {
        source: "name",
        maxLength: 96,
        slugify: (input) =>
          input
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
            .slice(0, 96),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "logo",
      title: "ロゴ",
      type: "image",
      options: { hotspot: false },
      fields: [
        defineField({
          name: "alt",
          title: "代替テキスト",
          type: "string",
          validation: (rule) => rule.max(200),
        }),
      ],
    }),
    defineField({
      name: "description",
      title: "会社概要",
      type: "text",
      rows: 4,
      validation: (rule) => rule.max(2000),
    }),
    defineField({
      name: "contactEmail",
      title: "問い合わせメール",
      type: "string",
      validation: (rule) =>
        rule.required().email().max(254).error("有効なメールアドレスを入力してください"),
    }),
    defineField({
      name: "contactPhone",
      title: "問い合わせ電話番号",
      type: "string",
      validation: (rule) =>
        rule
          .regex(/^[0-9+\-() ]{6,20}$/)
          .error("数字・ハイフン・括弧・プラス・空白のみ（6〜20 文字）"),
    }),
    defineField({
      name: "licenseNumber",
      title: "宅建業免許番号",
      type: "string",
      description: "例: 「東京都知事(3)第12345号」",
      validation: (rule) =>
        rule
          .required()
          .min(1)
          .max(60)
          .regex(/^(?:[^()（）\s]{1,12}(?:知事|大臣))[(（](\d{1,3})[)）]第\d{1,6}号$/)
          .error("宅建業免許番号の形式が不正です"),
    }),
    defineField({
      name: "representativeName",
      title: "代表者名",
      type: "string",
      validation: (rule) => rule.required().min(1).max(60),
    }),
    defineField({
      name: "websiteUrl",
      title: "Web サイト URL",
      type: "url",
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "licenseNumber",
      media: "logo",
    },
    prepare: ({ title, subtitle, media }) => ({
      title: typeof title === "string" ? title : "(未設定)",
      subtitle: typeof subtitle === "string" ? subtitle : undefined,
      media,
    }),
  },
  orderings: [
    {
      title: "会社名（昇順）",
      name: "nameAsc",
      by: [{ field: "name", direction: "asc" }],
    },
  ],
});
