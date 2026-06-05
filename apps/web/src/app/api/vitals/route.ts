/**
 * `/api/vitals` — クライアントから送られた Web Vitals メトリクスを受け取り、
 * in-memory store に積む POST エンドポイント。
 *
 * 設計判断:
 * - レート制限は既存の token bucket（`lib/rate-limit.ts`）を再利用。チャットや
 *   ingest と独立した bucket を切り、容量 60 / 補充 1 token per 1 秒（= 持続 60 req/min）
 *   で運用する。多数ページ巡回時の正常送信を確実に通すための余裕設定。
 * - 送信は `navigator.sendBeacon` から行う前提のため、レスポンスは軽量な
 *   `{ ok: true }` または `{ error }` の JSON のみ。`Cache-Control: no-store` を
 *   付与してプロキシキャッシュも避ける。
 * - 個人情報除外: `path` は **pathname のみ**（query string / hash を含めない）。
 *   サーバ側でも `sanitizePathname` で軽い検証を行い、`/foo?bar=1` や絶対 URL は弾く。
 * - User Agent は送信させない（ペイロードに含めない）。
 *
 * `sendBeacon` で送るペイロードと完全に同じスキーマを Zod で検証することで、
 * クライアント側の事故（query 付きの URL を path に入れた、未知 metric を投げた等）を
 * サーバ境界で食い止める。
 */

import { z } from "zod";
import { getClientIp } from "@/lib/get-client-ip";
import {
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getVitalsRateLimitConfig,
} from "@/lib/rate-limit";
import { recordVitalsSample } from "@/lib/vitals/store";
import { VITALS_METRIC_VALUES } from "@/lib/vitals/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `path` は pathname のみ（先頭スラッシュ・query なし・最大長 512）。
 *
 * - 先頭 `/` 必須
 * - `?` `#` 禁止（query / hash 混入を弾く）
 * - 絶対 URL（`http://...`）は先頭 `/` チェックで自動的に弾かれる
 * - 制御文字（C0 / DEL）はコードポイントで弾く
 */
const PathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => value.startsWith("/"), { message: "path は / で始まる必要があります" })
  .refine((value) => !value.includes("?") && !value.includes("#"), {
    message: "path に query / hash を含めないでください",
  })
  .refine(
    (value) => {
      // 制御文字（C0: 0x00–0x1F, DEL: 0x7F）を許可しない。
      // biome の `noControlCharactersInRegex` を回避するため codepoint で判定する。
      for (let i = 0; i < value.length; i += 1) {
        const code = value.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) return false;
      }
      return true;
    },
    { message: "path に制御文字を含めないでください" },
  );

const NavigationTypeSchema = z.enum(["navigate", "reload", "back_forward", "prerender", "restore"]);

const VitalsMetricSchema = z.enum(VITALS_METRIC_VALUES);

/**
 * 値は finite な数値で、メトリクスごとの妥当な範囲に収める。
 *
 * - CLS は無次元で 0–100 程度（100 超は事実上のバグ）
 * - 時間系メトリクスは ms。極端な外れ値（負値・1 時間超）は弾いて store を保護する
 */
const valueLimitForMetric = (metric: string): { min: number; max: number } => {
  if (metric === "CLS") return { min: 0, max: 100 };
  return { min: 0, max: 3_600_000 };
};

const BodySchema = z
  .object({
    metric: VitalsMetricSchema,
    value: z.number().finite(),
    path: PathSchema,
    navigationType: NavigationTypeSchema,
  })
  .refine(
    (data) => {
      const { min, max } = valueLimitForMetric(data.metric);
      return data.value >= min && data.value <= max;
    },
    { message: "value がメトリクスごとの妥当範囲外です", path: ["value"] },
  );

export type VitalsPostBody = z.infer<typeof BodySchema>;

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" } as const;

/**
 * `path` をサーバ側でもう一段サニタイズする（防御的）。
 *
 * Zod で検証済みのため通常は素通りするが、将来の Zod ルール緩和に備えて
 * 「query / hash 以降を強制的に切り落とす」一段を入れておく。
 */
export const sanitizePathname = (path: string): string => {
  const queryIndex = path.indexOf("?");
  const hashIndex = path.indexOf("#");
  const cutoff = [queryIndex, hashIndex].filter((idx) => idx >= 0).sort((a, b) => a - b)[0];
  return cutoff === undefined ? path : path.slice(0, cutoff);
};

export const POST = async (request: Request): Promise<Response> => {
  // レート制限を最優先で評価する。`sendBeacon` 経由でも DoS 化はあり得るため。
  const rateKey = buildRateLimitKey(getClientIp(request), "vitals");
  const rateResult = consumeRateLimit(rateKey, getVitalsRateLimitConfig());
  const rateHeaders = buildRateLimitHeaders(rateResult);
  if (!rateResult.allowed) {
    return new Response(
      JSON.stringify({ error: "rate_limited", retryAfterSeconds: rateResult.retryAfterSeconds }),
      {
        status: 429,
        headers: { ...rateHeaders, ...JSON_HEADERS },
      },
    );
  }

  let parsed: VitalsPostBody;
  try {
    // `sendBeacon` は MIME を自動で `application/json` にしないが、`Blob({ type })` で
    // 明示するパターンを採るのが推奨。サーバ側は Content-Type を見ずに `request.json()` を試す。
    const rawBody = (await request.json()) as unknown;
    parsed = BodySchema.parse(rawBody);
  } catch (error) {
    // 本番でも詳細はサーバログにとどめ、クライアントには定型文のみ返す。
    console.error("[vitals] リクエスト形式不正", error);
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { ...rateHeaders, ...JSON_HEADERS },
    });
  }

  const safePath = sanitizePathname(parsed.path);
  recordVitalsSample(parsed.metric, safePath, parsed.value);

  return new Response(JSON.stringify({ ok: true }), {
    status: 202, // 受理（実体は in-memory に積んだだけ）
    headers: { ...rateHeaders, ...JSON_HEADERS },
  });
};
