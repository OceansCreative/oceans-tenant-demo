import { prefectureValues } from "@oceans-tenant/shared";
import { defineField, defineType } from "sanity";

/**
 * エリアドキュメントタイプ。
 *
 * spec §6.4 に対応。検索ファセット用のエリア定義を表現する。
 * `coordinates` は Sanity 標準の geopoint 型を用いる。
 */
export const areaType = defineType({
  name: "area",
  title: "エリア",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "エリア名",
      type: "string",
      validation: (rule) => rule.required().min(1).max(60),
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
      name: "district",
      title: "細分エリア",
      description: '例: "西新宿"。市区町村より細かい区分が必要な場合に使う',
      type: "string",
      validation: (rule) => rule.max(80),
    }),
    defineField({
      name: "coordinates",
      title: "中心座標",
      type: "geopoint",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "parentArea",
      title: "親エリア",
      type: "reference",
      to: [{ type: "area" }],
    }),
    defineField({
      name: "sortOrder",
      title: "並び順",
      type: "number",
      validation: (rule) => rule.integer().min(0).max(9999),
    }),
  ],
  preview: {
    select: {
      title: "name",
      prefecture: "prefecture",
      city: "city",
      district: "district",
    },
    prepare: ({ title, prefecture, city, district }) => ({
      title: typeof title === "string" ? title : "(未設定)",
      subtitle: [prefecture, city, district].filter(Boolean).join(" / "),
    }),
  },
  orderings: [
    {
      title: "並び順（昇順）",
      name: "sortOrderAsc",
      by: [{ field: "sortOrder", direction: "asc" }],
    },
    {
      title: "都道府県 → 市区町村",
      name: "prefectureCityAsc",
      by: [
        { field: "prefecture", direction: "asc" },
        { field: "city", direction: "asc" },
      ],
    },
  ],
});
