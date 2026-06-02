import { propertySchema, searchCriteriaSchema } from "@oceans-tenant/shared";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Anthropic Tool Use の `input_schema` として渡せる JSON Schema 形。
 *
 * Anthropic SDK の `Tool["input_schema"]` は `{ type: "object", properties: {...} }`
 * の形を要求する。`zod-to-json-schema` の既定出力は `$schema` フィールドや
 * `definitions` を含むため、Tool に直接渡せるよう正規化する。
 *
 * SDK 側の型（`Tool.InputSchema`）は `required?: Array<string>` を期待するため、
 * 互換のために mutable な配列で型付けする。
 */
export type ToolInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: Array<string>;
  additionalProperties?: boolean;
  [key: string]: unknown;
};

/**
 * Zod スキーマを Anthropic Tool Use の input_schema 形に変換する。
 *
 * - `$schema` を除去（Anthropic API は受け付けない）
 * - 最上位の `type: "object"` を強制
 * - `additionalProperties` は Zod の `.strict()` を尊重して既定 false
 */
export const zodToToolInputSchema = (
  schema: Parameters<typeof zodToJsonSchema>[0],
): ToolInputSchema => {
  // target "jsonSchema7" は既定。$refStrategy "none" で `definitions` を展開し、
  // top-level に self-contained な object schema を得る。
  const raw = zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  });
  // 仕様上 top-level は object であることを Anthropic が要求する。
  const { $schema: _schema, ...rest } = raw as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...rest, type: "object" };
  return merged as ToolInputSchema;
};

/**
 * `/api/ingest-url` で使う `extract_property` ツール定義。
 *
 * Claude は HTML 本文から物件情報を抽出し、`propertySchema` 互換の入力で
 * このツールを呼び出す。サーバー側で `tool_use` ブロックの `input` を
 * そのまま Zod `safeParse` に渡すことで、構造化フォーマットを強制する。
 */
export const EXTRACT_PROPERTY_TOOL_NAME = "extract_property";
export const EXTRACT_PROPERTY_TOOL_DESCRIPTION =
  "HTML 本文から抽出した店舗物件情報を構造化された JSON で登録するためのツール。すべての抽出結果はこのツール経由で返すこと。";

export const extractPropertyTool = {
  name: EXTRACT_PROPERTY_TOOL_NAME,
  description: EXTRACT_PROPERTY_TOOL_DESCRIPTION,
  input_schema: zodToToolInputSchema(propertySchema),
} as const;

/**
 * `/api/chat-search` で使う `update_criteria` ツール定義。
 *
 * Claude はユーザー発話から検索条件を抽出して `searchCriteriaSchema` 互換の
 * `criteria` フィールドと共にこのツールを呼び出す。`message` は対話用の応答文。
 */
export const UPDATE_CRITERIA_TOOL_NAME = "update_criteria";
export const UPDATE_CRITERIA_TOOL_DESCRIPTION =
  "ユーザーの発話から推定した検索条件と、ユーザーに返す対話メッセージをまとめて登録するためのツール。条件更新の有無にかかわらず必ずこのツールを呼ぶこと。";

/**
 * `update_criteria` ツール入力の JSON Schema。
 *
 * `criteria` フィールドは `searchCriteriaSchema` 互換、`message` はユーザーへの
 * 応答文。`criteria` を省略した場合は「条件は変えない」を意味する。
 */
const UPDATE_CRITERIA_INPUT_SCHEMA: ToolInputSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "ユーザーに表示する 1〜2 文の応答文。条件が不足していれば質問する。",
      maxLength: 1000,
    },
    criteria: zodToToolInputSchema(searchCriteriaSchema),
  },
  required: ["message"],
  additionalProperties: false,
};

export const updateCriteriaTool = {
  name: UPDATE_CRITERIA_TOOL_NAME,
  description: UPDATE_CRITERIA_TOOL_DESCRIPTION,
  input_schema: UPDATE_CRITERIA_INPUT_SCHEMA,
} as const;
