import { describe, expect, it } from "vitest";
import { licenseNumberSchema, realEstateCompanySchema } from "./schema.js";

const baseCompany = {
  name: "サンプル不動産株式会社",
  slug: "sample-realty",
  description: "リファレンス実装用のダミー会社です。",
  contactEmail: "info@example.com",
  contactPhone: "03-1234-5678",
  licenseNumber: "東京都知事(3)第12345号",
  representativeName: "佐藤 太郎",
  websiteUrl: "https://example.com",
};

describe("licenseNumberSchema", () => {
  it("「東京都知事(3)第12345号」を受け入れる", () => {
    expect(licenseNumberSchema.parse("東京都知事(3)第12345号")).toBe("東京都知事(3)第12345号");
  });

  it("「国土交通大臣(1)第98765号」を受け入れる", () => {
    expect(licenseNumberSchema.parse("国土交通大臣(1)第98765号")).toBe("国土交通大臣(1)第98765号");
  });

  it("全角括弧でも受け入れる", () => {
    expect(licenseNumberSchema.parse("大阪府知事（5）第6789号")).toBe("大阪府知事（5）第6789号");
  });

  it("「知事」「大臣」を含まない場合は拒否", () => {
    expect(() => licenseNumberSchema.parse("東京都(3)第12345号")).toThrow();
  });

  it("番号がないと拒否", () => {
    expect(() => licenseNumberSchema.parse("東京都知事(3)")).toThrow();
  });

  it("空文字は拒否", () => {
    expect(() => licenseNumberSchema.parse("")).toThrow();
  });
});

describe("realEstateCompanySchema (有効ケース)", () => {
  it("完全なドキュメントを受け入れる", () => {
    expect(realEstateCompanySchema.parse(baseCompany).name).toBe("サンプル不動産株式会社");
  });

  it("任意フィールド未指定でも受け入れる", () => {
    const minimal = {
      name: "ミニマル不動産",
      slug: "minimal-realty",
      contactEmail: "test@example.com",
      licenseNumber: "千葉県知事(1)第1号",
      representativeName: "山田 花子",
    };
    expect(realEstateCompanySchema.parse(minimal)).toBeDefined();
  });

  it("ロゴ asset 参照 ID を受け入れる", () => {
    const withLogo = {
      ...baseCompany,
      logoAssetRef: "image-abc123-512x512-png",
    };
    expect(realEstateCompanySchema.parse(withLogo).logoAssetRef).toBe("image-abc123-512x512-png");
  });
});

describe("realEstateCompanySchema (失敗ケース)", () => {
  it("name が空だと拒否", () => {
    expect(() => realEstateCompanySchema.parse({ ...baseCompany, name: "" })).toThrow();
  });

  it("slug に大文字があると拒否", () => {
    expect(() => realEstateCompanySchema.parse({ ...baseCompany, slug: "Sample" })).toThrow();
  });

  it("contactEmail がメール形式でないと拒否", () => {
    expect(() =>
      realEstateCompanySchema.parse({
        ...baseCompany,
        contactEmail: "not-an-email",
      }),
    ).toThrow();
  });

  it("contactPhone が不正な文字を含むと拒否", () => {
    expect(() =>
      realEstateCompanySchema.parse({
        ...baseCompany,
        contactPhone: "03-1234-XXXX",
      }),
    ).toThrow();
  });

  it("licenseNumber が形式違反だと拒否", () => {
    expect(() =>
      realEstateCompanySchema.parse({
        ...baseCompany,
        licenseNumber: "なんちゃって免許",
      }),
    ).toThrow();
  });

  it("representativeName が空だと拒否", () => {
    expect(() =>
      realEstateCompanySchema.parse({ ...baseCompany, representativeName: "" }),
    ).toThrow();
  });

  it("websiteUrl が URL でないと拒否", () => {
    expect(() =>
      realEstateCompanySchema.parse({
        ...baseCompany,
        websiteUrl: "not-a-url",
      }),
    ).toThrow();
  });

  it("未知フィールドは strict で拒否", () => {
    expect(() =>
      realEstateCompanySchema.parse({
        ...baseCompany,
        unknownField: "x",
      }),
    ).toThrow();
  });

  it("logoAssetRef が Sanity 形式でないと拒否", () => {
    expect(() =>
      realEstateCompanySchema.parse({
        ...baseCompany,
        logoAssetRef: "abc",
      }),
    ).toThrow();
  });
});
