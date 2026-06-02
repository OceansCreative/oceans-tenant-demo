import { createClient, type SanityClient } from "@sanity/client";

/**
 * Sanity 実接続クライアントの生成レイヤ。
 *
 * env 三点セット
 * - `NEXT_PUBLIC_SANITY_PROJECT_ID`
 * - `NEXT_PUBLIC_SANITY_DATASET`
 * - `SANITY_API_READ_TOKEN`
 * が全て揃っていれば実クライアントを返し、不足していれば `null` を返す。
 *
 * 呼び出し側は `null` を受けたら mock fallback に切り替える前提でこの戻り値を扱う。
 * Phase 3 までは env を埋めない限り従来の mock 動作のままになるため、既存 UX / 既存テストを
 * 壊さずに段階的に切り替えられる。
 */

/**
 * `apiVersion` は後方互換性のため固定日付を埋め込む（Sanity 公式推奨）。
 * 日付を上げる際は projection / GROQ の semantics 差分を確認すること。
 */
export const SANITY_API_VERSION = "2024-01-01";

/**
 * 公開クエリは CDN 経由で高速化する。書き込みは行わないためトークンは read-only スコープ前提。
 */
const USE_CDN = true;

type SanityEnv = {
  readonly projectId: string;
  readonly dataset: string;
  readonly token: string;
};

const readEnv = (): SanityEnv | null => {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_READ_TOKEN;
  if (!projectId || !dataset || !token) {
    return null;
  }
  return { projectId, dataset, token };
};

/**
 * 必要な env が全て揃っていれば `SanityClient` を返し、欠落があれば `null` を返す。
 *
 * 呼び出し側は null チェックで mock fallback と切り替える。
 * env チェックを `null` ガード一発に集約することで、各ルート / page で
 * env リテラルを参照しないで済む（テスタビリティのためのインバージョン）。
 */
export const getSanityClient = (): SanityClient | null => {
  const env = readEnv();
  if (!env) {
    return null;
  }
  return createClient({
    projectId: env.projectId,
    dataset: env.dataset,
    apiVersion: SANITY_API_VERSION,
    token: env.token,
    useCdn: USE_CDN,
  });
};
