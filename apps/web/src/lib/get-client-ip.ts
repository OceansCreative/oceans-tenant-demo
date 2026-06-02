import { isIP } from "node:net";

/**
 * リクエストヘッダからクライアント IP を導出する pure 関数。
 *
 * Vercel / Cloudflare 等のリバースプロキシ配下を想定し、優先順に以下を解釈する:
 *
 * 1. `x-forwarded-for` の **最左** 値（クライアント実 IP）
 * 2. `x-real-ip`
 * 3. `host` ヘッダ（最終 fallback。同一でも全員 same bucket になるが安全側に倒す）
 *
 * 取り出した値が `node:net.isIP` で IPv4 / IPv6 として妥当でない場合は
 * `"unknown"` を返す。IPv6 ブラケット表記 `[::1]` や末尾ポート `:443` を素朴に
 * 除去するため、明らかなノイズも吸収する。
 *
 * テスト容易性のため Request からは header しか参照せず、副作用は持たない。
 */
export const getClientIp = (request: Request): string => {
  const headers = request.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const leftmost = xff.split(",")[0]?.trim() ?? "";
    const normalized = normalizeIpCandidate(leftmost);
    if (normalized && isIP(normalized) !== 0) {
      return normalized;
    }
  }
  const xrealip = headers.get("x-real-ip");
  if (xrealip) {
    const normalized = normalizeIpCandidate(xrealip.trim());
    if (normalized && isIP(normalized) !== 0) {
      return normalized;
    }
  }
  const host = headers.get("host");
  if (host) {
    // host は IP でない可能性が高いが、不正でも "unknown" よりはバケットを
    // 分散できるためそのまま返す（IP 検証は通さない）。
    return host;
  }
  return "unknown";
};

/**
 * IPv6 ブラケット `[::1]:443` やポート付き IPv4 `1.2.3.4:5678` を素朴に正規化する。
 * 完全な仕様パースはしないが、Vercel / Cloudflare の代表的な書式は吸収できる。
 */
const normalizeIpCandidate = (value: string): string => {
  if (value.length === 0) return value;
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end > 0) {
      return value.slice(1, end);
    }
  }
  // IPv4 にポートが付いている場合のみコロンで分割（IPv6 はコロン多数なので除外）
  const colonCount = (value.match(/:/g) ?? []).length;
  if (colonCount === 1) {
    const [host] = value.split(":");
    return host ?? value;
  }
  return value;
};
