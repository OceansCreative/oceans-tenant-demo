import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemas/index.js";
import { structure } from "./structure/index.js";

/**
 * Sanity Studio v3 のワークスペース定義。
 *
 * - `projectId` と `dataset` は `NEXT_PUBLIC_SANITY_*` 環境変数から取得する。
 *   未設定の場合は `placeholder` を返し、`/studio` ルートのフォールバック分岐で吸収する。
 * - structure tool（カスタム Desk: 物件を availability ごとに分類）と
 *   vision tool（GROQ プレイグラウンド）を有効化。
 * - schemas は `apps/studio/schemas/index.ts` の `schemaTypes` を一括登録する。
 * - Desk Structure 定義は `apps/studio/structure/index.ts`。
 */
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "placeholder";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "placeholder";

export const sanityConfig = defineConfig({
  name: "oceans-tenant",
  title: "OceansTenant Studio",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [structureTool({ structure }), visionTool()],
  schema: {
    types: [...schemaTypes],
  },
});

export default sanityConfig;
