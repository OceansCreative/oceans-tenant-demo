/**
 * 共通フォーマッタ。賃料表示、住所要約など。
 */

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const compactYenFormatter = new Intl.NumberFormat("ja-JP", {
  notation: "compact",
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 1,
});

export const formatJpy = (value: number): string => yenFormatter.format(value);

export const formatJpyCompact = (value: number): string => compactYenFormatter.format(value);

export const formatTsubo = (value: number): string => `${value.toFixed(2)} 坪`;
export const formatSquareMeter = (value: number): string => `${value.toFixed(1)} ㎡`;

export type AddressSummary = {
  readonly prefecture: string;
  readonly city: string;
  readonly streetAddress?: string;
};

export const formatAddressSummary = (address: AddressSummary): string =>
  [address.prefecture, address.city, address.streetAddress].filter(Boolean).join(" ");
