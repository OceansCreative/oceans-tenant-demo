/**
 * Admin 機能の feature flag。
 *
 * v0.10.0 WS-1 で `/admin` 配下を新設するにあたり、本番運用との安全な切り離しを目的として
 * `NEXT_PUBLIC_ADMIN_ENABLED=true` の **文字列完全一致** でのみ有効化する。
 *
 * - 真偽値が緩い解釈になると（"1" / "TRUE" / " true " 等）デプロイ事故が起きやすい
 * - そのため許可するのは厳密に `"true"` 文字列のみ
 * - middleware / page / API Route すべてここを経由して判定する
 *
 * @remarks
 *   この feature flag は **認証ではなく可視性制御** であり、env が有効になっていれば
 *   誰でも `/admin` にアクセスできる前提。本番運用での認証統合は別 PR で扱う。
 *
 *   本番デモ（demo.oceans-base.com/tenant-search 等）では `false` を強く推奨する。
 *   どうしても enable する場合は、まず `SANITY_API_TOKEN`（書き込み）を Vercel から
 *   外し、`SANITY_API_READ_TOKEN`（Viewer）のみで動かす read-only 構成を検討する。
 *   そうすれば admin UI から書き込み API を叩いても Sanity 側で 403 となり、
 *   公開デモへ意図しない変更が反映されない。詳細は docs/PRODUCTION_SAFETY.md 参照。
 */

const ADMIN_ENABLED_ENV_VALUE = "true";

/**
 * 与えられた env 値が admin を有効化する形式かどうかを判定する。
 *
 * 例えば middleware から `process.env.NEXT_PUBLIC_ADMIN_ENABLED` を渡して使う。
 * テスト時には任意の値を直接渡せるようにファクトリ風の純粋関数として切り出す。
 */
export const parseAdminEnabledFlag = (value: string | undefined): boolean =>
  value === ADMIN_ENABLED_ENV_VALUE;

/**
 * 現在のプロセスで admin が有効かどうかを返す。
 *
 * `NEXT_PUBLIC_*` 接頭辞のため Next.js のビルド時に静的に埋め込まれ、Client / Server
 * 双方で同じ値を見ることができる（middleware は server 実行）。
 */
export const isAdminEnabled = (): boolean =>
  parseAdminEnabledFlag(process.env.NEXT_PUBLIC_ADMIN_ENABLED);
