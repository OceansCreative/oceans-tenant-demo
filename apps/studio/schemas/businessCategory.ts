import { businessCategoryIconLabel, businessCategoryIconValues } from "@oceans-tenant/shared";
import { defineField, defineType } from "sanity";

/**
 * 業種カテゴリドキュメントタイプ。
 *
 * spec §6.3 に対応。自己参照（parent）でツリー構造を表現する。
 * property.suitableBusinesses から参照される。
 */
export const businessCategoryType = defineType({
  name: "businessCategory",
  title: "業種カテゴリ",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "カテゴリ名",
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
      name: "parent",
      title: "親カテゴリ",
      description: "存在する場合は親カテゴリへの参照。ルートカテゴリは空にする",
      type: "reference",
      to: [{ type: "businessCategory" }],
      // NOTE: 自身を親にしないなど、循環参照の防止は Studio 側で運用する。
    }),
    defineField({
      name: "icon",
      title: "アイコン",
      type: "string",
      options: {
        list: businessCategoryIconValues.map((value) => ({
          value,
          title: businessCategoryIconLabel[value],
        })),
        layout: "dropdown",
      },
    }),
    defineField({
      name: "description",
      title: "説明",
      type: "text",
      rows: 3,
      validation: (rule) => rule.max(500),
    }),
    defineField({
      name: "sortOrder",
      title: "並び順",
      type: "number",
      description: "UI 上での表示順。小さいほど上位",
      validation: (rule) => rule.integer().min(0).max(9999),
    }),
  ],
  preview: {
    select: {
      title: "name",
      parentName: "parent.name",
      icon: "icon",
    },
    prepare: ({ title, parentName, icon }) => ({
      title: typeof title === "string" ? title : "(未設定)",
      subtitle:
        [
          typeof parentName === "string" ? `親: ${parentName}` : undefined,
          typeof icon === "string"
            ? ((businessCategoryIconLabel as Record<string, string>)[icon] ?? icon)
            : undefined,
        ]
          .filter(Boolean)
          .join(" / ") || undefined,
    }),
  },
  orderings: [
    {
      title: "並び順（昇順）",
      name: "sortOrderAsc",
      by: [{ field: "sortOrder", direction: "asc" }],
    },
    {
      title: "カテゴリ名（昇順）",
      name: "nameAsc",
      by: [{ field: "name", direction: "asc" }],
    },
  ],
});
