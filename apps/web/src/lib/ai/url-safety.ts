/**
 * SSRF (Server-Side Request Forgery) 防御ユーティリティ。
 *
 * `/api/ingest-url` のように外部 URL を fetch する経路で必ず使う。
 *
 * 提供するのは:
 * - `assertPublicIp(hostname)`: DNS 解決した IP がインターネット公開レンジに
 *   含まれることを検査。private / loopback / link-local / multicast /
 *   予約レンジは拒否する（IPv4 / IPv6 両対応）。
 * - `fetchHtmlSafe(url, opts)`: per-hop で URL → DNS → IP 検証を行いつつ
 *   redirect を手動追跡し、レスポンスサイズも上限で打ち切る安全な fetch。
 *
 * 参考:
 * - OWASP SSRF Prevention Cheat Sheet
 * - https://en.wikipedia.org/wiki/Reserved_IP_addresses
 */
import { lookup } from "node:dns/promises";
import { isIP, isIPv4, isIPv6 } from "node:net";

export class SsrfDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfDeniedError";
  }
}

export class FetchSafetyError extends Error {
  constructor(
    message: string,
    readonly code:
      | "size_exceeded"
      | "too_many_redirects"
      | "invalid_scheme"
      | "invalid_redirect"
      | "fetch_failed",
  ) {
    super(message);
    this.name = "FetchSafetyError";
  }
}

const ipv4ToInt = (ip: string): number => {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    throw new SsrfDeniedError(`不正な IPv4 アドレス: ${ip}`);
  }
  // 4 オクテットを 32-bit 符号無し整数として連結
  // biome-ignore lint/style/noNonNullAssertion: 上で parts.length === 4 を確認済み
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
};

const inIpv4Range = (ip: string, network: string, prefix: number): boolean => {
  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
};

/**
 * IPv4 の private/reserved レンジ判定。
 * 参考: https://en.wikipedia.org/wiki/Reserved_IP_addresses
 */
const FORBIDDEN_IPV4_RANGES: ReadonlyArray<readonly [string, number, string]> = [
  ["0.0.0.0", 8, "this network"],
  ["10.0.0.0", 8, "private"],
  ["100.64.0.0", 10, "CGNAT"],
  ["127.0.0.0", 8, "loopback"],
  ["169.254.0.0", 16, "link-local (cloud metadata)"],
  ["172.16.0.0", 12, "private"],
  ["192.0.0.0", 24, "IETF protocol"],
  ["192.0.2.0", 24, "TEST-NET-1"],
  ["192.88.99.0", 24, "6to4 anycast"],
  ["192.168.0.0", 16, "private"],
  ["198.18.0.0", 15, "benchmark"],
  ["198.51.100.0", 24, "TEST-NET-2"],
  ["203.0.113.0", 24, "TEST-NET-3"],
  ["224.0.0.0", 4, "multicast"],
  // broadcast (/32) を reserved (/4) より前に置いて、より具体的な reason を返す
  ["255.255.255.255", 32, "broadcast"],
  ["240.0.0.0", 4, "reserved"],
];

export const isForbiddenIpv4 = (ip: string): { forbidden: boolean; reason?: string } => {
  for (const [network, prefix, reason] of FORBIDDEN_IPV4_RANGES) {
    if (inIpv4Range(ip, network, prefix)) {
      return { forbidden: true, reason };
    }
  }
  return { forbidden: false };
};

/**
 * IPv6 の private/reserved 判定。
 */
export const isForbiddenIpv6 = (ip: string): { forbidden: boolean; reason?: string } => {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return { forbidden: true, reason: "loopback" };
  }
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") {
    return { forbidden: true, reason: "unspecified" };
  }
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — 埋め込まれた IPv4 を再検査
  const mappedMatch = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedMatch?.[1]) {
    const inner = isForbiddenIpv4(mappedMatch[1]);
    if (inner.forbidden) {
      return { forbidden: true, reason: `IPv4-mapped (${inner.reason})` };
    }
  }
  // Unique Local Address: fc00::/7（fc00〜fdff）
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) {
    return { forbidden: true, reason: "ULA (private)" };
  }
  // Link-local: fe80::/10（fe80〜febf）
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) {
    return { forbidden: true, reason: "link-local" };
  }
  // Multicast: ff00::/8
  if (/^ff[0-9a-f]{2}:/.test(normalized)) {
    return { forbidden: true, reason: "multicast" };
  }
  // Discard: 100::/64
  if (/^100:[0]{0,4}:/.test(normalized)) {
    return { forbidden: true, reason: "discard" };
  }
  // Documentation: 2001:db8::/32
  if (/^2001:db8:/.test(normalized)) {
    return { forbidden: true, reason: "documentation" };
  }
  return { forbidden: false };
};

/**
 * DNS 解決の差し替えを可能にするインターフェース（テスト用）。
 */
export type ResolveHostname = (hostname: string) => Promise<string>;

const defaultResolveHostname: ResolveHostname = async (hostname) => {
  // IP リテラルがそのまま渡された場合はそのまま返す（hostname は URL.host 由来）
  if (isIP(hostname) !== 0) return hostname;
  const result = await lookup(hostname);
  return result.address;
};

export type AssertPublicIpOptions = {
  readonly resolve?: ResolveHostname;
};

/**
 * ホスト名（または IP リテラル）が公開レンジに含まれることを保証する。
 * 違反したら `SsrfDeniedError` を投げる。
 */
export const assertPublicIp = async (
  hostname: string,
  options: AssertPublicIpOptions = {},
): Promise<string> => {
  if (!hostname || hostname.length > 253) {
    throw new SsrfDeniedError(`不正なホスト名: ${hostname}`);
  }
  // URL.host が `[::1]` のように角括弧付きで来る可能性
  const cleaned = hostname.replace(/^\[|\]$/g, "");
  const resolve = options.resolve ?? defaultResolveHostname;
  const ip = await resolve(cleaned);

  if (isIPv4(ip)) {
    const check = isForbiddenIpv4(ip);
    if (check.forbidden) {
      throw new SsrfDeniedError(`内部レンジへのアクセスは拒否されました (${check.reason}): ${ip}`);
    }
    return ip;
  }
  if (isIPv6(ip)) {
    const check = isForbiddenIpv6(ip);
    if (check.forbidden) {
      throw new SsrfDeniedError(`内部レンジへのアクセスは拒否されました (${check.reason}): ${ip}`);
    }
    return ip;
  }
  throw new SsrfDeniedError(`解決後の値が IP アドレスではありません: ${ip}`);
};

export type FetchHtmlSafeOptions = {
  readonly maxBytes?: number;
  readonly maxRedirects?: number;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  /** テスト用の依存性注入。指定がなければ DNS lookup を用いる。 */
  readonly resolve?: ResolveHostname;
  /** テスト用の依存性注入。指定がなければ globalThis.fetch を用いる。 */
  readonly fetchImpl?: typeof globalThis.fetch;
};

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_USER_AGENT =
  "OceansTenantBot/0.1 (+https://github.com/OceansCreative/oceans-tenant-demo)";

const readBodyWithLimit = async (response: Response, maxBytes: number): Promise<string> => {
  // Content-Length での早期拒否
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declared = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new FetchSafetyError(
        `応答サイズが上限を超えています: ${declared} > ${maxBytes}`,
        "size_exceeded",
      );
    }
  }
  const reader = response.body?.getReader();
  if (!reader) {
    // body がない場合はそのまま空文字（リダイレクトレスポンス等）
    return "";
  }
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new FetchSafetyError(
        `応答サイズが上限を超えました: ${total} > ${maxBytes}`,
        "size_exceeded",
      );
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
};

export type FetchHtmlSafeResult = {
  readonly url: string;
  readonly status: number;
  readonly body: string;
  readonly redirected: ReadonlyArray<string>;
};

/**
 * SSRF 対策込みの HTML 取得関数。
 *
 * - http/https のみを許可
 * - 各ホップで URL → DNS → IP を検証
 * - 最大 `maxRedirects` ホップで打ち切る
 * - レスポンスは `maxBytes` で打ち切る
 * - タイムアウトは `timeoutMs`
 */
export const fetchHtmlSafe = async (
  initialUrl: string,
  options: FetchHtmlSafeOptions = {},
): Promise<FetchHtmlSafeResult> => {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const redirected: string[] = [];
  let currentUrl = initialUrl;

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const parsed = new URL(currentUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new FetchSafetyError(`不正なスキーム: ${parsed.protocol}`, "invalid_scheme");
      }
      await assertPublicIp(parsed.hostname, { resolve: options.resolve });

      const response = await fetchImpl(currentUrl, {
        method: "GET",
        headers: { "User-Agent": userAgent, Accept: "text/html" },
        signal: controller.signal,
        redirect: "manual",
      });

      // 30x: Location ヘッダで次のホップを決定
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new FetchSafetyError(
            "リダイレクト応答ですが Location ヘッダがありません",
            "invalid_redirect",
          );
        }
        if (hop === maxRedirects) {
          throw new FetchSafetyError(
            `リダイレクト回数の上限を超えました: ${maxRedirects}`,
            "too_many_redirects",
          );
        }
        // 相対 URL も解決
        const next = new URL(location, currentUrl).toString();
        redirected.push(next);
        currentUrl = next;
        // body は読まず破棄
        await response.body?.cancel?.();
        continue;
      }

      const body = await readBodyWithLimit(response, maxBytes);
      return {
        url: currentUrl,
        status: response.status,
        body,
        redirected,
      };
    }
    // ループ抜けは到達しない（hop <= maxRedirects で必ず return か throw）
    throw new FetchSafetyError("予期しない状態", "fetch_failed");
  } finally {
    clearTimeout(timeoutId);
  }
};
