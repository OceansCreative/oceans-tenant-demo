/**
 * SSRF (Server-Side Request Forgery) 防御ユーティリティ。
 *
 * `/api/ingest-url` のように外部 URL を fetch する経路で必ず使う。
 *
 * 提供するのは:
 * - `assertPublicIp(hostname)`: DNS 解決した IP がインターネット公開レンジに
 *   含まれることを検査。
 *   - IPv4: `node:net` の `BlockList` で 17 の予約レンジを拒否
 *   - IPv6: `2000::/3`（グローバルユニキャスト）の **アロウリスト** に
 *     `2001:db8::/32`（documentation）等の **二段ブロック** を組み合わせ
 *   - `lookup(host, { all: true })` で全 A/AAAA を検査（攻撃者が複数応答で
 *     片方だけ public を混ぜる手口を遮断）
 * - `fetchHtmlSafe(url, opts)`: per-hop で URL → DNS → IP 検証を行い、
 *   さらに検証した IP に **undici Agent の lookup を固定**して接続。
 *   これにより DNS リバインディング (TOCTOU) で「検証時は public・接続時は
 *   private」になる攻撃を遮断する（Issue #63）。
 *
 * 参考:
 * - OWASP SSRF Prevention Cheat Sheet
 * - IANA IPv6 Special-Purpose Address Registry
 * - https://en.wikipedia.org/wiki/Reserved_IP_addresses
 */
import { lookup } from "node:dns/promises";
import { BlockList, isIP, isIPv4, isIPv6 } from "node:net";
import { Agent } from "undici";

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

// ------------------------------------------------------------
// IPv4: BlockList ベースの拒否リスト
// ------------------------------------------------------------

type SubnetEntry = {
  readonly network: string;
  readonly prefix: number;
  readonly reason: string;
};

const IPV4_FORBIDDEN: ReadonlyArray<SubnetEntry> = [
  { network: "0.0.0.0", prefix: 8, reason: "this network" },
  { network: "10.0.0.0", prefix: 8, reason: "private" },
  { network: "100.64.0.0", prefix: 10, reason: "CGNAT" },
  { network: "127.0.0.0", prefix: 8, reason: "loopback" },
  { network: "169.254.0.0", prefix: 16, reason: "link-local (cloud metadata)" },
  { network: "172.16.0.0", prefix: 12, reason: "private" },
  { network: "192.0.0.0", prefix: 24, reason: "IETF protocol" },
  { network: "192.0.2.0", prefix: 24, reason: "TEST-NET-1" },
  { network: "192.88.99.0", prefix: 24, reason: "6to4 anycast" },
  { network: "192.168.0.0", prefix: 16, reason: "private" },
  { network: "198.18.0.0", prefix: 15, reason: "benchmark" },
  { network: "198.51.100.0", prefix: 24, reason: "TEST-NET-2" },
  { network: "203.0.113.0", prefix: 24, reason: "TEST-NET-3" },
  { network: "224.0.0.0", prefix: 4, reason: "multicast" },
  // broadcast (/32) を reserved (/4) より前に置いて、より具体的な reason を返す
  { network: "255.255.255.255", prefix: 32, reason: "broadcast" },
  { network: "240.0.0.0", prefix: 4, reason: "reserved" },
];

const IPV4_BLOCKLIST: ReadonlyArray<{ list: BlockList; reason: string }> = IPV4_FORBIDDEN.map(
  ({ network, prefix, reason }) => {
    const list = new BlockList();
    list.addSubnet(network, prefix, "ipv4");
    return { list, reason };
  },
);

export const isForbiddenIpv4 = (ip: string): { forbidden: boolean; reason?: string } => {
  for (const { list, reason } of IPV4_BLOCKLIST) {
    if (list.check(ip, "ipv4")) {
      return { forbidden: true, reason };
    }
  }
  return { forbidden: false };
};

// ------------------------------------------------------------
// IPv6: 2000::/3 アロウリスト + 内部ブロックリスト
// ------------------------------------------------------------

// グローバルユニキャストは 2000::/3 のみ。これ以外は private/reserved/multicast/...
const IPV6_GLOBAL_UNICAST = new BlockList();
IPV6_GLOBAL_UNICAST.addSubnet("2000::", 3, "ipv6");

const IPV6_GLOBAL_BLOCKS: ReadonlyArray<SubnetEntry> = [
  // 2000::/3 内に存在する特殊用途レンジ
  { network: "2001:db8::", prefix: 32, reason: "documentation" },
  { network: "2002::", prefix: 16, reason: "6to4" },
  { network: "2001::", prefix: 32, reason: "Teredo" },
];

const IPV6_BLOCKLIST: ReadonlyArray<{ list: BlockList; reason: string }> = IPV6_GLOBAL_BLOCKS.map(
  ({ network, prefix, reason }) => {
    const list = new BlockList();
    list.addSubnet(network, prefix, "ipv6");
    return { list, reason };
  },
);

/**
 * IPv4-mapped IPv6 (`::ffff:a.b.c.d` または `::ffff:XXXX:XXXX`) を IPv4 に展開する。
 * 該当しなければ null を返す。
 */
const extractIpv4Mapped = (ipv6: string): string | null => {
  const normalized = ipv6.toLowerCase();
  // ドット記法: `::ffff:169.254.169.254`
  const dotMatch = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotMatch?.[1]) return dotMatch[1];
  // 16進記法: `::ffff:a9fe:a9fe` → 169.254.169.254
  const hexMatch = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMatch?.[1] && hexMatch?.[2]) {
    const hi = Number.parseInt(hexMatch[1], 16);
    const lo = Number.parseInt(hexMatch[2], 16);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
};

/**
 * IPv6 の禁止判定。
 *
 * 1. IPv4-mapped (ドット / 16進両形式) を IPv4 に展開して再検査
 * 2. グローバルユニキャスト 2000::/3 に **含まれなければ拒否**（アロウリスト）
 * 3. 2000::/3 内でも documentation / 6to4 / Teredo 等の特殊用途は拒否
 */
export const isForbiddenIpv6 = (ip: string): { forbidden: boolean; reason?: string } => {
  // IPv4-mapped を IPv4 に展開
  const mappedIpv4 = extractIpv4Mapped(ip);
  if (mappedIpv4) {
    const inner = isForbiddenIpv4(mappedIpv4);
    if (inner.forbidden) {
      return { forbidden: true, reason: `IPv4-mapped (${inner.reason})` };
    }
    // IPv4 として公開レンジでも、IPv4-mapped IPv6 自体を許可するかは要判断。
    // 既存の Node 実装では `lookup` がドット形式で返すため到達経路は限定的だが、
    // 念のため IPv4-mapped 自体を非公開扱いとして拒否する（攻撃面を最小化）。
    return { forbidden: true, reason: "IPv4-mapped IPv6 (use IPv4 directly)" };
  }
  // アロウリスト: 2000::/3 グローバルユニキャストのみ通す
  if (!IPV6_GLOBAL_UNICAST.check(ip, "ipv6")) {
    return { forbidden: true, reason: "outside 2000::/3 global unicast" };
  }
  // 2000::/3 内の特殊用途
  for (const { list, reason } of IPV6_BLOCKLIST) {
    if (list.check(ip, "ipv6")) {
      return { forbidden: true, reason };
    }
  }
  return { forbidden: false };
};

// ------------------------------------------------------------
// assertPublicIp: ホスト名 → 全 A/AAAA → 公開レンジ判定
// ------------------------------------------------------------

export type ResolveHostnameAll = (hostname: string) => Promise<ReadonlyArray<string>>;

const defaultResolveHostnameAll: ResolveHostnameAll = async (hostname) => {
  if (isIP(hostname) !== 0) return [hostname];
  // `all: true` で複数 A/AAAA を全て取得。
  // 攻撃者が「public + private」を混ぜて返した場合に片方だけ検証する事故を防ぐ。
  const records = await lookup(hostname, { all: true });
  return records.map((r) => r.address);
};

export type AssertPublicIpOptions = {
  /** テスト用の DI。指定がなければ `dns.lookup(host, { all: true })` を使う */
  readonly resolveAll?: ResolveHostnameAll;
};

/**
 * ホスト名（または IP リテラル）が公開レンジに含まれることを保証する。
 *
 * 解決した **全 IP** が公開レンジでなければ `SsrfDeniedError` を投げる。
 * 戻り値は接続に使うべき IP（最初の公開 IP）。
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
  const resolveAll = options.resolveAll ?? defaultResolveHostnameAll;
  const ips = await resolveAll(cleaned);
  if (ips.length === 0) {
    throw new SsrfDeniedError(`ホスト名を解決できませんでした: ${hostname}`);
  }

  for (const ip of ips) {
    if (isIPv4(ip)) {
      const check = isForbiddenIpv4(ip);
      if (check.forbidden) {
        throw new SsrfDeniedError(
          `内部レンジへのアクセスは拒否されました (${check.reason}): ${ip}`,
        );
      }
    } else if (isIPv6(ip)) {
      const check = isForbiddenIpv6(ip);
      if (check.forbidden) {
        throw new SsrfDeniedError(
          `内部レンジへのアクセスは拒否されました (${check.reason}): ${ip}`,
        );
      }
    } else {
      throw new SsrfDeniedError(`解決後の値が IP アドレスではありません: ${ip}`);
    }
  }
  // 全 IP が公開レンジ。接続にはリストの先頭を使う。
  return ips[0] as string;
};

// ------------------------------------------------------------
// fetchHtmlSafe: per-hop SSRF 検証 + DNS ピン留めで TOCTOU 遮断
// ------------------------------------------------------------

export type FetchHtmlSafeOptions = {
  readonly maxBytes?: number;
  readonly maxRedirects?: number;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  /** テスト用の依存性注入。指定がなければ `dns.lookup(host, { all: true })` を用いる。 */
  readonly resolveAll?: ResolveHostnameAll;
  /** テスト用の依存性注入。指定がなければ globalThis.fetch を用いる。 */
  readonly fetchImpl?: typeof globalThis.fetch;
  /** テスト用 hook。本番では undefined で良い。 */
  readonly onValidatedIp?: (ip: string) => void;
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

/**
 * pinned IP を返す lookup 関数を純関数として生成する。
 *
 * **コールバックは配列形式** `cb(null, [{ address, family }])` を返す。
 * Node 20+ では `net.createConnection` の `autoSelectFamily` が既定 true で、
 * 内部で `lookup(host, { all: true }, cb)` を呼び `[{address, family}, ...]` の
 * 配列を期待する（Happy Eyeballs RFC 8305）。単一形式 `cb(null, ip, family)` を
 * 返すと `ERR_INVALID_IP_ADDRESS` で接続前に弾かれる（v0.1.3 リグレッションの原因、Issue #81）。
 *
 * 関数として export することで、`buildPinnedDispatcher` の組み立てを経由せずに
 * 配列形式の戻り値を直接ユニットテストできる（Issue #85 の dead assertion 対策）。
 */
export type PinnedLookup = (
  hostname: string,
  options: unknown,
  // 配列形式は [{address, family}, ...]
  callback: (
    error: NodeJS.ErrnoException | null,
    addresses: ReadonlyArray<{ address: string; family: 4 | 6 }>,
  ) => void,
) => void;

export const pinnedLookup =
  (ip: string): PinnedLookup =>
  (_hostname, _options, callback) => {
    const family: 4 | 6 = ip.includes(":") ? 6 : 4;
    callback(null, [{ address: ip, family }]);
  };

/**
 * 検証済み IP を undici Agent の lookup に強制注入し、fetch の DNS 解決を
 * 完全にバイパスする。これにより validated IP と connected IP の一致を保証する。
 *
 * 実装は `pinnedLookup` を Agent に組み込むだけ。Lookup 形式の正しさは
 * `pinnedLookup` 単体テスト + 実 undici + ローカルサーバの結合テストで保証する。
 */
export const buildPinnedDispatcher = (ip: string): Agent => {
  return new Agent({
    connect: {
      // biome-ignore lint/suspicious/noExplicitAny: undici LookupFunction の型を吸収
      lookup: pinnedLookup(ip) as any,
    },
  });
};

export type FetchHtmlSafeResult = {
  readonly url: string;
  readonly status: number;
  readonly body: string;
  readonly redirected: ReadonlyArray<string>;
};

/**
 * SSRF + DNS リバインディング対策込みの HTML 取得関数。
 *
 * - http/https のみを許可
 * - 各ホップで URL → DNS → 全 A/AAAA → IP 公開レンジ検証
 * - 検証で得た IP を undici Agent の `connect.lookup` に強制注入し、
 *   fetch 内部での独立 DNS 解決を遮断（TOCTOU 攻撃を遮断、Issue #63）
 * - 最大 `maxRedirects` ホップで打ち切る
 * - レスポンスは `maxBytes` で打ち切る
 * - タイムアウトは `timeoutMs`
 *
 * HTTPS の SNI / 証明書検証は元の hostname を保つため、IP リテラルへの
 * URL 書き換えはしない（dispatcher 経由で接続先のみピン留め）。
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
      const validatedIp = await assertPublicIp(parsed.hostname, {
        resolveAll: options.resolveAll,
      });
      options.onValidatedIp?.(validatedIp);

      const dispatcher = buildPinnedDispatcher(validatedIp);
      let response: Response;
      try {
        // dispatcher は標準 fetch の型に含まれないため unknown 経由でキャスト。
        // Node.js (undici) ランタイムでのみ有効。
        response = await fetchImpl(currentUrl, {
          method: "GET",
          headers: { "User-Agent": userAgent, Accept: "text/html" },
          signal: controller.signal,
          redirect: "manual",
          // biome-ignore lint/suspicious/noExplicitAny: undici 拡張オプションを std fetch 型に注入
          dispatcher,
        } as RequestInit & { dispatcher: Agent });
      } finally {
        // Agent はホップごとに使い捨て。リソースリークを防ぐため close する。
        // テストの fetchImpl モックでは dispatcher を無視する場合があるため、エラーを握りつぶす。
        dispatcher.close().catch(() => {});
      }

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
