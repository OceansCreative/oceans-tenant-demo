import { createClient, type SanityClient } from "@sanity/client";
import { SANITY_API_VERSION } from "@/lib/sanity/client";

/**
 * Sanity 書き込み用クライアントの生成レイヤ。
 *
 * read-only クライアント (`getSanityClient`) とは別系統で、`SANITY_API_TOKEN`（Editor 権限）が
 * 揃ったときだけ実 client を返す。token が無ければ `null` を返し、上位レイヤで mock fallback に
 * 切り替える前提。
 *
 * - `useCdn: false`: 書き込みは CDN を経由できない
 * - `apiVersion`: 読み取り側と同じ固定日付（後方互換）
 *
 * @remarks
 *   `SANITY_API_TOKEN` は **Editor 以上** の権限が必要。Viewer では `createOrReplace` 等が 403 になる。
 *   トークン管理は Vercel 環境変数 / `.env.local` で行い、絶対にコミットしない。
 */

const USE_CDN = false;

type SanityWriteEnv = {
  readonly projectId: string;
  readonly dataset: string;
  readonly token: string;
};

const readEnv = (): SanityWriteEnv | null => {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_TOKEN;
  if (!projectId || !dataset || !token) {
    return null;
  }
  return { projectId, dataset, token };
};

/**
 * 書き込み用 `SanityClient` を返す。env 不足時は `null`。
 *
 * `null` を受けた呼び出し側は in-memory mock fallback に切り替えること。
 * 単一の関数で env チェックを集約することで、各 API Route / mutation で
 * env リテラルを参照せずに済む（テスト時の env スタブが 1 箇所で完結）。
 */
export const getSanityWriteClient = (): SanityClient | null => {
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
