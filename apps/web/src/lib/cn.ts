/**
 * Tailwind クラス名を安全に結合するヘルパー。
 * Falsy 値は除外し、重複の解決は呼び出し側で意識する。
 */
export const cn = (...inputs: ReadonlyArray<string | false | null | undefined>): string =>
  inputs.filter((value): value is string => Boolean(value)).join(" ");
