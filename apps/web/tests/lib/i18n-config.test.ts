import { describe, expect, it } from "vitest";
import { defaultLocale, isLocale, LOCALE_COOKIE_NAME, locales } from "@/i18n/config";

describe("i18n/config", () => {
  it("対応 locale に ja と en が含まれる", () => {
    expect(locales).toEqual(["ja", "en"]);
  });

  it("デフォルト locale は ja", () => {
    expect(defaultLocale).toBe("ja");
  });

  it("cookie 名は NEXT_LOCALE", () => {
    expect(LOCALE_COOKIE_NAME).toBe("NEXT_LOCALE");
  });

  it("isLocale は対応 locale だけ true を返す", () => {
    expect(isLocale("ja")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(0)).toBe(false);
    expect(isLocale("")).toBe(false);
  });
});
