/**
 * IP × エンドポイント単位の in-memory token bucket レート制限。
 *
 * **重要な前提**: 本実装は **同一 Node プロセスのメモリ内** にバケットを持つ。
 * Vercel のような serverless 環境では各インスタンスが独立しているため、
 * 全 region / 全インスタンス横断の正確な制限は**保証されない**。
 * 本番運用で厳密な集中制御が必要な場合は Upstash Redis / Cloudflare KV 等の
 * 共有ストアに差し替えること（インタフェースは `consumeRateLimit` を中心に
 * 拡張可能な形で抽出済み）。
 *
 * 設計判断:
 * - **Lazy refill**: `consume` 呼び出し時にだけ前回からの経過時間で補充。cron 不要。
 * - **LRU 風 evict**: エントリが上限を超えたら最も古い `lastSeen` から削除。
 *   完全な O(1) LRU ではないが、規模が小さいので O(N) スキャンで十分。
 * - **エンドポイント別 bucket**: `${ip}:${endpoint}` をキーにすることで、
 *   chat-search と ingest-url を独立に制限できる。
 *
 * 制限値は環境変数で上書き可能（README 参照）。
 */

export type RateLimitConfig = {
  /** バケット容量（最大同時 burst 数） */
  readonly capacity: number;
  /** 1 トークンを補充する間隔（ミリ秒） */
  readonly refillIntervalMs: number;
};

export type RateLimitResult = {
  readonly allowed: boolean;
  /** 制限値（=`capacity`） */
  readonly limit: number;
  /** 消費後の残りトークン数（拒否時は 0） */
  readonly remaining: number;
  /** バケットが満タンになる Unix 時刻（秒） */
  readonly resetEpochSeconds: number;
  /** 拒否時に次に 1 トークン補充されるまでの秒数（許可時は 0） */
  readonly retryAfterSeconds: number;
};

type Bucket = {
  tokens: number;
  lastRefillMs: number;
  lastSeenMs: number;
};

/**
 * メモリ上限。プロセス内に保持する `(ip, endpoint)` の組合せが
 * これを超えたら古いものから削除する。OSS デモ用としては余裕を見て 1000。
 */
const MAX_ENTRIES = 1000;

const buckets = new Map<string, Bucket>();

/**
 * テスト用にバケット状態を初期化する。**プロダクションコードから呼ばないこと**。
 */
export const __resetRateLimitForTesting = (): void => {
  buckets.clear();
};

/**
 * 環境変数で容量・補充間隔を上書きできる helper。
 *
 * - 未設定 / 数値変換失敗 → fallback
 * - 0 以下 → fallback（無効化はテストでも不要なため受け付けない）
 */
const readConfigFromEnv = (
  capacityEnv: string | undefined,
  refillEnv: string | undefined,
  fallback: RateLimitConfig,
): RateLimitConfig => {
  const parsedCapacity = capacityEnv !== undefined ? Number.parseInt(capacityEnv, 10) : Number.NaN;
  const parsedRefill = refillEnv !== undefined ? Number.parseInt(refillEnv, 10) : Number.NaN;
  return {
    capacity:
      Number.isFinite(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : fallback.capacity,
    refillIntervalMs:
      Number.isFinite(parsedRefill) && parsedRefill > 0 ? parsedRefill : fallback.refillIntervalMs,
  };
};

/**
 * `/api/chat-search` 用設定。
 * 容量 20 / 補充 1 token per 6 sec → 持続 10 req/min、短時間 burst は 20 まで許容。
 * 環境変数: `RATE_LIMIT_CHAT_CAPACITY`, `RATE_LIMIT_CHAT_REFILL_INTERVAL_MS`
 */
export const getChatSearchRateLimitConfig = (): RateLimitConfig =>
  readConfigFromEnv(
    process.env.RATE_LIMIT_CHAT_CAPACITY,
    process.env.RATE_LIMIT_CHAT_REFILL_INTERVAL_MS,
    { capacity: 20, refillIntervalMs: 6_000 },
  );

/**
 * `/api/ingest-url` 用設定。
 * 容量 10 / 補充 1 token per 12 sec → 持続 5 req/min。AI コストが高めなので緩い設定。
 * 環境変数: `RATE_LIMIT_INGEST_CAPACITY`, `RATE_LIMIT_INGEST_REFILL_INTERVAL_MS`
 */
export const getIngestUrlRateLimitConfig = (): RateLimitConfig =>
  readConfigFromEnv(
    process.env.RATE_LIMIT_INGEST_CAPACITY,
    process.env.RATE_LIMIT_INGEST_REFILL_INTERVAL_MS,
    { capacity: 10, refillIntervalMs: 12_000 },
  );

/**
 * バケットエントリ数が `MAX_ENTRIES` を超えていたら、最も古い `lastSeenMs` を
 * 持つエントリから 1 件削除する（簡易 LRU）。Map の反復順は挿入順なので、
 * `lastSeenMs` 更新時に `delete` → `set` で末尾に移動する `touch` も併用する。
 *
 * 計算量は O(N) だが、`MAX_ENTRIES=1000` 程度であれば数十マイクロ秒。
 */
const evictIfNeeded = (): void => {
  if (buckets.size <= MAX_ENTRIES) return;
  // Map の反復順（挿入順 = ほぼ LRU 順）の先頭を消す。
  const firstKey = buckets.keys().next();
  if (!firstKey.done) {
    buckets.delete(firstKey.value);
  }
};

/**
 * `key` のバケットを取得（存在しなければ新規）。最後にアクセスを末尾へ移して
 * 簡易 LRU を維持する。
 */
const touchBucket = (key: string, nowMs: number, capacity: number): Bucket => {
  const existing = buckets.get(key);
  if (existing) {
    // touch: 末尾へ移動
    buckets.delete(key);
    existing.lastSeenMs = nowMs;
    buckets.set(key, existing);
    return existing;
  }
  const created: Bucket = {
    tokens: capacity,
    lastRefillMs: nowMs,
    lastSeenMs: nowMs,
  };
  buckets.set(key, created);
  evictIfNeeded();
  return created;
};

/**
 * `key` のバケットから 1 トークンを消費しようと試みる。
 *
 * - 経過時間に応じて lazy に補充（capacity 上限まで）
 * - 残量 ≥ 1 → 消費して `allowed: true`
 * - 残量 < 1 → `allowed: false`、`retryAfterSeconds` を返す
 *
 * @param key `${ip}:${endpoint}` の合成キー。
 * @param config 容量・補充間隔
 * @param nowMs テスト用に時刻を注入できるよう external clock を受け付ける（既定 `Date.now()`）
 */
export const consumeRateLimit = (
  key: string,
  config: RateLimitConfig,
  nowMs: number = Date.now(),
): RateLimitResult => {
  const bucket = touchBucket(key, nowMs, config.capacity);

  // lazy refill: 経過分のトークンを追加
  const elapsedMs = Math.max(0, nowMs - bucket.lastRefillMs);
  const refillTokens = Math.floor(elapsedMs / config.refillIntervalMs);
  if (refillTokens > 0) {
    bucket.tokens = Math.min(config.capacity, bucket.tokens + refillTokens);
    bucket.lastRefillMs += refillTokens * config.refillIntervalMs;
  }

  const limit = config.capacity;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    const remaining = bucket.tokens;
    // 満タンまでに必要な残り時間（次の補充までの残時間 + 不足分 × interval）
    const tokensToFull = limit - remaining;
    const msToNextRefill = config.refillIntervalMs - (nowMs - bucket.lastRefillMs);
    const msToFull =
      tokensToFull === 0 ? 0 : msToNextRefill + (tokensToFull - 1) * config.refillIntervalMs;
    const resetEpochSeconds = Math.ceil((nowMs + Math.max(0, msToFull)) / 1000);
    return {
      allowed: true,
      limit,
      remaining,
      resetEpochSeconds,
      retryAfterSeconds: 0,
    };
  }

  // 拒否: 次に 1 トークン補充されるまでの秒数を計算
  const msToNextRefill = Math.max(0, config.refillIntervalMs - (nowMs - bucket.lastRefillMs));
  const retryAfterSeconds = Math.max(1, Math.ceil(msToNextRefill / 1000));
  const resetEpochSeconds = Math.ceil(
    (nowMs + msToNextRefill + (limit - 1) * config.refillIntervalMs) / 1000,
  );
  return {
    allowed: false,
    limit,
    remaining: 0,
    resetEpochSeconds,
    retryAfterSeconds,
  };
};

/**
 * `(ip, endpoint)` の合成キーを作る。
 *
 * `ip` 側のセパレータと衝突しないよう、エンドポイント名は固定文字列のみを
 * 想定しコロン区切りにしている（IPv6 にコロンが含まれるが、エンドポイント名
 * の方には `:` を入れない約束）。
 */
export const buildRateLimitKey = (ip: string, endpoint: string): string => `${ip}::${endpoint}`;

/**
 * 拒否時に返す HTTP 429 レスポンス用のヘッダ・body 雛形を構築する。
 * SSE / JSON どちらの route でも共通で使えるよう、Response は呼び出し側で組み立てる。
 */
export const buildRateLimitHeaders = (result: RateLimitResult): Record<string, string> => {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetEpochSeconds),
  };
  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }
  return headers;
};
