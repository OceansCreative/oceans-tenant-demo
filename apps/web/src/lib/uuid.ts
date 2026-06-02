/**
 * crypto.randomUUID をブラウザ・Node の両環境で薄く包む。
 *
 * フォールバック経路は `crypto.getRandomValues` を必ず使用する（暗号論的に安全な乱数）。
 * Math.random は予測可能なため、セッション識別子等のセキュリティコンテキストでは使わない
 * （CodeQL `js/insecure-randomness` 対策）。jsdom / Node 20+ / 全モダンブラウザで `getRandomValues`
 * は利用可能なので、`Math.random` ベースのフォールバックは廃止。
 */
export const generateUuidV4 = (): string => {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
    throw new Error(
      "crypto.randomUUID も crypto.getRandomValues も利用できない環境では UUID を生成できません",
    );
  }
  // RFC 4122 §4.4 準拠の v4 UUID を crypto.getRandomValues から組み立てる
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  // version 4 (random) を bits 12-15 of time_hi_and_version に設定
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  // variant 10 (RFC 4122) を bits 6-7 of clock_seq_hi_and_reserved に設定
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
};
