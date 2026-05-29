import {
  availabilityLabel,
  availabilityValues,
  buildingTypeLabel,
  buildingTypeValues,
  conditionLabel,
  conditionValues,
  prefectureValues,
  squareMeterToTsubo,
} from "@oceans-tenant/shared";
import { defineField, defineType } from "sanity";

/**
 * 店舗物件ドキュメントタイプ。
 *
 * spec §6.1 に対応。坪数は preview 内で ㎡ から自動換算するため、ドキュメント側で
 * 保持しない（必要なら GROQ で `*[_type=="property"]{..., "tsubo": area * 0.3025}` で算出可能）。
 */
export const propertyType = defineType({
  name: "property",
  title: "店舗物件",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "物件タイトル",
      type: "string",
      validation: (rule) => rule.required().min(1).max(120),
    }),
    defineField({
      name: "slug",
      title: "スラッグ",
      type: "slug",
      options: {
        source: "title",
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
      name: "address",
      title: "住所",
      type: "object",
      fields: [
        defineField({
          name: "prefecture",
          title: "都道府県",
          type: "string",
          options: {
            list: prefectureValues.map((value) => ({ value, title: value })),
            layout: "dropdown",
          },
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "city",
          title: "市区町村",
          type: "string",
          validation: (rule) => rule.required().min(1).max(80),
        }),
        defineField({
          name: "streetAddress",
          title: "番地",
          type: "string",
          validation: (rule) => rule.max(120),
        }),
        defineField({
          name: "buildingName",
          title: "建物名",
          type: "string",
          validation: (rule) => rule.max(120),
        }),
        defineField({
          name: "roomNumber",
          title: "部屋番号",
          type: "string",
          validation: (rule) => rule.max(40),
        }),
        defineField({
          name: "geopoint",
          title: "緯度経度",
          type: "geopoint",
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "nearestStations",
      title: "最寄り駅",
      type: "array",
      of: [
        {
          type: "object",
          name: "nearestStation",
          fields: [
            defineField({
              name: "line",
              title: "路線",
              type: "string",
              validation: (rule) => rule.required().min(1).max(60),
            }),
            defineField({
              name: "station",
              title: "駅名",
              type: "string",
              validation: (rule) => rule.required().min(1).max(40),
            }),
            defineField({
              name: "walkMinutes",
              title: "徒歩分",
              type: "number",
              validation: (rule) => rule.required().integer().min(0).max(60),
            }),
          ],
          preview: {
            select: { line: "line", station: "station", walk: "walkMinutes" },
            prepare: ({ line, station, walk }) => ({
              title: `${station ?? "—"} (${line ?? "—"})`,
              subtitle: walk !== undefined ? `徒歩 ${walk} 分` : undefined,
            }),
          },
        },
      ],
      validation: (rule) => rule.max(5),
    }),
    defineField({
      name: "rent",
      title: "賃料（円 / 月）",
      type: "number",
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: "commonFee",
      title: "共益費（円 / 月）",
      type: "number",
      validation: (rule) => rule.integer().min(0),
    }),
    defineField({
      name: "depositMonths",
      title: "敷金（月数）",
      type: "number",
      validation: (rule) => rule.min(0).max(24),
    }),
    defineField({
      name: "keyMoneyMonths",
      title: "礼金（月数）",
      type: "number",
      validation: (rule) => rule.min(0).max(24),
    }),
    defineField({
      name: "area",
      title: "専有面積（㎡）",
      type: "number",
      description: "坪数はプレビューで自動換算（1 ㎡ = 0.3025 坪）",
      validation: (rule) => rule.required().positive().max(10000),
    }),
    defineField({
      name: "floor",
      title: "階数表記",
      type: "string",
      validation: (rule) => rule.max(40),
    }),
    defineField({
      name: "buildingType",
      title: "建物形態",
      type: "string",
      options: {
        list: buildingTypeValues.map((value) => ({
          value,
          title: buildingTypeLabel[value],
        })),
        layout: "radio",
        direction: "horizontal",
      },
    }),
    defineField({
      name: "condition",
      title: "物件状態",
      type: "string",
      options: {
        list: conditionValues.map((value) => ({
          value,
          title: conditionLabel[value],
        })),
        layout: "radio",
        direction: "horizontal",
      },
    }),
    defineField({
      name: "previousBusiness",
      title: "前テナント業種",
      type: "string",
      validation: (rule) => rule.max(120),
    }),
    defineField({
      name: "suitableBusinesses",
      title: "適合業種",
      type: "array",
      of: [
        {
          type: "reference",
          to: [{ type: "businessCategory" }],
        },
      ],
      validation: (rule) => rule.max(20),
    }),
    defineField({
      name: "images",
      title: "画像",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "代替テキスト",
              type: "string",
              validation: (rule) => rule.max(200),
            }),
            defineField({
              name: "isPrimary",
              title: "メイン画像",
              type: "boolean",
              initialValue: false,
            }),
          ],
        },
      ],
      validation: (rule) => rule.max(30),
    }),
    defineField({
      name: "description",
      title: "物件説明",
      type: "text",
      rows: 6,
      validation: (rule) => rule.max(4000),
    }),
    defineField({
      name: "features",
      title: "特徴タグ",
      type: "array",
      of: [{ type: "string", validation: (rule) => rule.min(1).max(40) }],
      options: { layout: "tags" },
      validation: (rule) => rule.max(20),
    }),
    defineField({
      name: "availability",
      title: "公開状態",
      type: "string",
      options: {
        list: availabilityValues.map((value) => ({
          value,
          title: availabilityLabel[value],
        })),
        layout: "radio",
        direction: "horizontal",
      },
      initialValue: "public",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "listedBy",
      title: "掲載元（不動産会社）",
      type: "reference",
      to: [{ type: "realEstateCompany" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "sourceUrl",
      title: "抽出元 URL",
      type: "url",
      description: "AI による抽出時のソースページ",
    }),
    defineField({
      name: "aiExtracted",
      title: "AI 抽出か",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "aiConfidence",
      title: "AI 抽出の信頼度（0〜1）",
      type: "number",
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { aiExtracted?: boolean } | undefined;
          if (parent?.aiExtracted === true && value === undefined) {
            return "AI 抽出された物件には信頼度が必須です";
          }
          if (parent?.aiExtracted !== true && value !== undefined) {
            return "AI 抽出でない物件には信頼度を入れないでください";
          }
          if (value !== undefined && (value < 0 || value > 1)) {
            return "信頼度は 0〜1 の範囲で指定してください";
          }
          return true;
        }),
    }),
    defineField({
      name: "publishedAt",
      title: "公開日時",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: "title",
      area: "area",
      rent: "rent",
      availability: "availability",
      media: "images.0.asset",
    },
    prepare: ({ title, area, rent, availability, media }) => {
      const tsubo = typeof area === "number" ? squareMeterToTsubo(area).toFixed(2) : "—";
      const formattedRent = typeof rent === "number" ? `${(rent / 10000).toFixed(1)}万円/月` : "—";
      const status =
        typeof availability === "string"
          ? ((availabilityLabel as Record<string, string>)[availability] ?? availability)
          : "—";
      return {
        title: typeof title === "string" ? title : "(未設定)",
        subtitle: `${area ?? "—"}㎡ / ${tsubo}坪 ・ ${formattedRent} ・ ${status}`,
        media,
      };
    },
  },
  orderings: [
    {
      title: "公開日時（新しい順）",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
    {
      title: "賃料（安い順）",
      name: "rentAsc",
      by: [{ field: "rent", direction: "asc" }],
    },
  ],
});
