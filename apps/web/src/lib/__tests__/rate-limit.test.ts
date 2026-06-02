import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetRateLimitForTesting,
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getChatSearchRateLimitConfig,
  getIngestUrlRateLimitConfig,
  type RateLimitConfig,
} from "@/lib/rate-limit";

/**
 * Token bucket レート制限のユニットテスト。
 *
 * - 容量上限 / 補充 / LRU evict / IP・エンドポイント独立性 / 429 ヘッダ
 * - 時刻は `consumeRateLimit` の第 3 引数で注入することで vi.useFakeTimers 不要
 *   （Date.now を差し替えるよりテストが読みやすい）。
 */

const SMALL_CONFIG: RateLimitConfig = {
  capacity: 3,
  refillIntervalMs: 1_000,
};

describe("consumeRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitForTesting();
  });

  it("初回呼び出しは容量から 1 つ消費して allowed=true", () => {
    const result = consumeRateLimit("ip-a::chat", SMALL_CONFIG, 0);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(3);
    expect(result.remaining).toBe(2);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("容量を使い切るまで連続許可、超過したら拒否し Retry-After を返す", () => {
    const k = "ip-b::chat";
    expect(consumeRateLimit(k, SMALL_CONFIG, 0).allowed).toBe(true);
    expect(consumeRateLimit(k, SMALL_CONFIG, 0).allowed).toBe(true);
    const lastAllowed = consumeRateLimit(k, SMALL_CONFIG, 0);
    expect(lastAllowed.allowed).toBe(true);
    expect(lastAllowed.remaining).toBe(0);

    const denied = consumeRateLimit(k, SMALL_CONFIG, 0);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(1);
  });

  it("補充間隔を超えた経過時間で 1 トークンずつ補充される", () => {
    const k = "ip-c::chat";
    // 容量 3 を一気に消費
    consumeRateLimit(k, SMALL_CONFIG, 0);
    consumeRateLimit(k, SMALL_CONFIG, 0);
    consumeRateLimit(k, SMALL_CONFIG, 0);
    expect(consumeRateLimit(k, SMALL_CONFIG, 0).allowed).toBe(false);

    // 1 秒経過 → 1 トークン補充 → 1 件だけ通る
    expect(consumeRateLimit(k, SMALL_CONFIG, 1_000).allowed).toBe(true);
    expect(consumeRateLimit(k, SMALL_CONFIG, 1_000).allowed).toBe(false);

    // さらに 2 秒経過 → 2 トークン補充
    expect(consumeRateLimit(k, SMALL_CONFIG, 3_000).allowed).toBe(true);
    expect(consumeRateLimit(k, SMALL_CONFIG, 3_000).allowed).toBe(true);
    expect(consumeRateLimit(k, SMALL_CONFIG, 3_000).allowed).toBe(false);
  });

  it("長期放置後でも capacity 上限を超えて補充されない", () => {
    const k = "ip-d::chat";
    consumeRateLimit(k, SMALL_CONFIG, 0);
    // 1 時間放置
    const after = consumeRateLimit(k, SMALL_CONFIG, 3_600_000);
    // remaining は最大 capacity - 1 = 2（自身が 1 消費したため）
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(2);
  });

  it("別 IP のバケットは独立している", () => {
    const a = "ip-x::chat";
    const b = "ip-y::chat";
    // A を使い切る
    for (let i = 0; i < SMALL_CONFIG.capacity; i++) {
      expect(consumeRateLimit(a, SMALL_CONFIG, 0).allowed).toBe(true);
    }
    expect(consumeRateLimit(a, SMALL_CONFIG, 0).allowed).toBe(false);
    // B は無影響
    expect(consumeRateLimit(b, SMALL_CONFIG, 0).allowed).toBe(true);
  });

  it("別エンドポイントのバケットは独立している", () => {
    const chat = buildRateLimitKey("ip-z", "chat-search");
    const ingest = buildRateLimitKey("ip-z", "ingest-url");
    for (let i = 0; i < SMALL_CONFIG.capacity; i++) {
      expect(consumeRateLimit(chat, SMALL_CONFIG, 0).allowed).toBe(true);
    }
    expect(consumeRateLimit(chat, SMALL_CONFIG, 0).allowed).toBe(false);
    // 同じ IP でも別エンドポイントなら独立に容量を持つ
    expect(consumeRateLimit(ingest, SMALL_CONFIG, 0).allowed).toBe(true);
  });

  it("X-RateLimit-Reset は単調増加（再消費しても過去にならない）", () => {
    const k = "ip-r::chat";
    const r1 = consumeRateLimit(k, SMALL_CONFIG, 0);
    const r2 = consumeRateLimit(k, SMALL_CONFIG, 100);
    expect(r2.resetEpochSeconds).toBeGreaterThanOrEqual(r1.resetEpochSeconds - 1);
  });

  it("LRU evict: MAX_ENTRIES(=1000) を超えると古いキーが削除される", () => {
    // 1001 件投入
    for (let i = 0; i < 1001; i++) {
      consumeRateLimit(buildRateLimitKey(`ip-${i}`, "chat-search"), SMALL_CONFIG, i);
    }
    // ip-0 のバケットは evict されているはず（再度叩くと最初の 1 件と同じ allowed=true,
    // remaining=2 が返る、つまり「リセットされた」状態）
    const result = consumeRateLimit(buildRateLimitKey("ip-0", "chat-search"), SMALL_CONFIG, 9_999);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
});

describe("buildRateLimitKey", () => {
  it("ip とエンドポイントを :: 区切りで結合する", () => {
    expect(buildRateLimitKey("1.2.3.4", "chat-search")).toBe("1.2.3.4::chat-search");
  });

  it("IPv6 アドレスでもエンドポイント部と曖昧にならない", () => {
    const v6 = "2001:db8::1";
    const key = buildRateLimitKey(v6, "ingest-url");
    expect(key.endsWith("::ingest-url")).toBe(true);
    // 区切りは :: が **エンドポイントの直前** のみで使われていることを確認
    expect(key.split("::ingest-url")[0]).toBe(v6);
  });
});

describe("buildRateLimitHeaders", () => {
  it("allowed の場合は X-RateLimit-* のみ", () => {
    const headers = buildRateLimitHeaders({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetEpochSeconds: 1_700_000_000,
      retryAfterSeconds: 0,
    });
    expect(headers["X-RateLimit-Limit"]).toBe("20");
    expect(headers["X-RateLimit-Remaining"]).toBe("19");
    expect(headers["X-RateLimit-Reset"]).toBe("1700000000");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("denied の場合は Retry-After を含む", () => {
    const headers = buildRateLimitHeaders({
      allowed: false,
      limit: 20,
      remaining: 0,
      resetEpochSeconds: 1_700_000_000,
      retryAfterSeconds: 6,
    });
    expect(headers["Retry-After"]).toBe("6");
  });
});

describe("getChatSearchRateLimitConfig / getIngestUrlRateLimitConfig", () => {
  const ENV_KEYS = [
    "RATE_LIMIT_CHAT_CAPACITY",
    "RATE_LIMIT_CHAT_REFILL_INTERVAL_MS",
    "RATE_LIMIT_INGEST_CAPACITY",
    "RATE_LIMIT_INGEST_REFILL_INTERVAL_MS",
  ] as const;
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = original[k];
      }
    }
  });

  it("chat-search の既定値は 容量 20 / 6 秒", () => {
    const cfg = getChatSearchRateLimitConfig();
    expect(cfg.capacity).toBe(20);
    expect(cfg.refillIntervalMs).toBe(6_000);
  });

  it("ingest-url の既定値は 容量 10 / 12 秒", () => {
    const cfg = getIngestUrlRateLimitConfig();
    expect(cfg.capacity).toBe(10);
    expect(cfg.refillIntervalMs).toBe(12_000);
  });

  it("環境変数で容量・補充間隔を上書きできる", () => {
    process.env.RATE_LIMIT_CHAT_CAPACITY = "100";
    process.env.RATE_LIMIT_CHAT_REFILL_INTERVAL_MS = "500";
    const cfg = getChatSearchRateLimitConfig();
    expect(cfg.capacity).toBe(100);
    expect(cfg.refillIntervalMs).toBe(500);
  });

  it("不正な環境変数値は fallback に倒れる", () => {
    process.env.RATE_LIMIT_INGEST_CAPACITY = "not-a-number";
    process.env.RATE_LIMIT_INGEST_REFILL_INTERVAL_MS = "-1";
    const cfg = getIngestUrlRateLimitConfig();
    expect(cfg.capacity).toBe(10);
    expect(cfg.refillIntervalMs).toBe(12_000);
  });
});
