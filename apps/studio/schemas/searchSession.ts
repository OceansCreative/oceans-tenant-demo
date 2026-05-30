import { defineField, defineType } from "sanity";

/**
 * 対話型検索セッションのドキュメントタイプ。
 *
 * spec §6.5 に対応。AI 対話の履歴と抽出条件、ヒット結果を保持する。
 * 通常 Studio から編集することは想定せず、デバッグや分析用に閲覧する。
 */
export const searchSessionType = defineType({
  name: "searchSession",
  title: "検索セッション",
  type: "document",
  fields: [
    defineField({
      name: "sessionId",
      title: "セッション ID",
      description: "UUID v4 形式",
      type: "string",
      validation: (rule) =>
        rule
          .required()
          .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
          .error("UUID v4 形式である必要があります"),
    }),
    defineField({
      name: "messages",
      title: "メッセージ履歴",
      type: "array",
      of: [
        {
          type: "object",
          name: "chatMessage",
          fields: [
            defineField({
              name: "role",
              title: "発話者",
              type: "string",
              options: {
                list: [
                  { value: "user", title: "ユーザー" },
                  { value: "assistant", title: "アシスタント" },
                  { value: "system", title: "システム" },
                ],
                layout: "radio",
                direction: "horizontal",
              },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "content",
              title: "内容",
              type: "text",
              rows: 3,
              validation: (rule) => rule.required().min(1).max(4000),
            }),
            defineField({
              name: "createdAt",
              title: "発話時刻",
              type: "datetime",
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { role: "role", content: "content" },
            prepare: ({ role, content }) => ({
              title: typeof content === "string" ? content.slice(0, 60) : "(空)",
              subtitle: typeof role === "string" ? role : undefined,
            }),
          },
        },
      ],
      validation: (rule) => rule.max(100),
    }),
    defineField({
      name: "extractedCriteria",
      title: "抽出された検索条件",
      description: "AI が会話から抽出した検索条件の JSON",
      type: "object",
      fields: [
        defineField({
          name: "prefectures",
          title: "都道府県",
          type: "array",
          of: [{ type: "string" }],
        }),
        defineField({
          name: "cities",
          title: "市区町村",
          type: "array",
          of: [{ type: "string" }],
        }),
        defineField({
          name: "minRent",
          title: "賃料下限（円）",
          type: "number",
          validation: (rule) => rule.integer().min(0),
        }),
        defineField({
          name: "maxRent",
          title: "賃料上限（円）",
          type: "number",
          validation: (rule) => rule.integer().min(0),
        }),
        defineField({
          name: "minArea",
          title: "面積下限（㎡）",
          type: "number",
          validation: (rule) => rule.positive(),
        }),
        defineField({
          name: "maxArea",
          title: "面積上限（㎡）",
          type: "number",
          validation: (rule) => rule.positive(),
        }),
        defineField({
          name: "businessCategoryRefs",
          title: "業種カテゴリ",
          type: "array",
          of: [{ type: "reference", to: [{ type: "businessCategory" }] }],
        }),
        defineField({
          name: "features",
          title: "特徴タグ",
          type: "array",
          of: [{ type: "string" }],
        }),
        defineField({
          name: "freeText",
          title: "自由記述",
          type: "text",
          rows: 3,
        }),
      ],
    }),
    defineField({
      name: "resultProperties",
      title: "ヒット物件",
      type: "array",
      of: [{ type: "reference", to: [{ type: "property" }] }],
      validation: (rule) => rule.max(200),
    }),
    defineField({
      name: "createdAt",
      title: "作成日時",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "updatedAt",
      title: "更新日時",
      type: "datetime",
      validation: (rule) =>
        rule.required().custom((value, context) => {
          const parent = context.document as { createdAt?: string } | undefined;
          if (
            parent?.createdAt &&
            typeof value === "string" &&
            new Date(value) < new Date(parent.createdAt)
          ) {
            return "updatedAt は createdAt 以降である必要があります";
          }
          return true;
        }),
    }),
  ],
  preview: {
    select: {
      title: "sessionId",
      messages: "messages",
      createdAt: "createdAt",
    },
    prepare: ({ title, messages, createdAt }) => ({
      title: typeof title === "string" ? `セッション ${title.slice(0, 8)}` : "(ID 未設定)",
      subtitle: [
        Array.isArray(messages) ? `${messages.length} メッセージ` : undefined,
        typeof createdAt === "string" ? new Date(createdAt).toLocaleString("ja-JP") : undefined,
      ]
        .filter(Boolean)
        .join(" ・ "),
    }),
  },
  orderings: [
    {
      title: "更新日時（新しい順）",
      name: "updatedAtDesc",
      by: [{ field: "updatedAt", direction: "desc" }],
    },
  ],
});
