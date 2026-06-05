/**
 * `/api/vitals/summary` — in-memory store に蓄積されたサンプルを `MetricSummary[]`
 * に集計して返す read-only GET エンドポイント。
 *
 * 設計判断:
 * - 認証は付けない（OSS デモのため、データ自体が個人特定情報を含まない設計）。
 *   本番運用時は管理者ロール限定にする等、`getAllSummary` を含む側で wrap する想定。
 * - Server Component の `/insights/page.tsx` からは fetch を経由せず直接
 *   `getAllVitalsSummary()` を呼ぶ（同プロセス内のため）。本 route はクライアント側
 *   からのデバッグ用 / ダッシュボードの将来的な refetch 用に残す。
 * - `Cache-Control: no-store` で常に最新を返す。
 */

import { getAllVitalsSummary } from "@/lib/vitals/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (): Promise<Response> => {
  const summaries = getAllVitalsSummary();
  return new Response(JSON.stringify({ summaries }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
