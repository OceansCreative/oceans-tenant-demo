import { describe, expect, it } from "vitest";
import {
  businessCategoryIconLabel,
  businessCategoryIconSchema,
  businessCategoryIconValues,
  businessCategorySchema,
} from "./schema.js";

describe("businessCategoryIconSchema", () => {
  it("9 種類のアイコンをすべて受け入れる", () => {
    expect(businessCategoryIconValues).toHaveLength(9);
    for (const value of businessCategoryIconValues) {
      expect(businessCategoryIconSchema.parse(value)).toBe(value);
    }
  });

  it("各アイコンに日本語ラベルが定義されている", () => {
    for (const value of businessCategoryIconValues) {
      expect(businessCategoryIconLabel[value]).toBeTruthy();
    }
  });

  it("未知のアイコンは拒否", () => {
    expect(() => businessCategoryIconSchema.parse("hotel")).toThrow();
  });
});

describe("businessCategorySchema", () => {
  const baseCategory = {
    name: "カフェ",
    slug: "cafe",
    icon: "cafe" as const,
    description: "コーヒー・軽食を提供する業態",
    sortOrder: 10,
  };

  it("ルートカテゴリを受け入れる（parentRef なし）", () => {
    expect(businessCategorySchema.parse(baseCategory).name).toBe("カフェ");
  });

  it("子カテゴリを受け入れる（parentRef あり）", () => {
    expect(
      businessCategorySchema.parse({
        ...baseCategory,
        slug: "personal-cafe",
        name: "個人経営カフェ",
        parentRef: "cafe-parent-id",
      }).parentRef,
    ).toBe("cafe-parent-id");
  });

  it("最小構成（name + slug のみ）でも受け入れる", () => {
    expect(businessCategorySchema.parse({ name: "その他", slug: "other" })).toBeDefined();
  });

  it("name が空だと拒否", () => {
    expect(() => businessCategorySchema.parse({ ...baseCategory, name: "" })).toThrow();
  });

  it("slug に大文字があると拒否", () => {
    expect(() => businessCategorySchema.parse({ ...baseCategory, slug: "Cafe" })).toThrow();
  });

  it("sortOrder が負だと拒否", () => {
    expect(() => businessCategorySchema.parse({ ...baseCategory, sortOrder: -1 })).toThrow();
  });

  it("sortOrder が小数だと拒否", () => {
    expect(() => businessCategorySchema.parse({ ...baseCategory, sortOrder: 1.5 })).toThrow();
  });

  it("parentRef が不正な文字を含むと拒否", () => {
    expect(() =>
      businessCategorySchema.parse({
        ...baseCategory,
        parentRef: "invalid id with spaces",
      }),
    ).toThrow();
  });

  it("未知フィールドは strict で拒否", () => {
    expect(() => businessCategorySchema.parse({ ...baseCategory, unknownField: "x" })).toThrow();
  });
});
