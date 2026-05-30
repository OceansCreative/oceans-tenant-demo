/**
 * crypto.randomUUID をブラウザ・Node の両環境で薄く包む。
 */
export const generateUuidV4 = (): string => {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // フォールバック: jsdom など crypto.randomUUID が無い環境向け
  const random = (length: number): string =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const variant = ["8", "9", "a", "b"][Math.floor(Math.random() * 4)] ?? "8";
  return `${random(8)}-${random(4)}-4${random(3)}-${variant}${random(3)}-${random(12)}`;
};
