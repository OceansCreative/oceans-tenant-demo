import { describe, expect, it } from "vitest";
import {
  aiExtractionMetaSchema,
  derivePropertyTsubo,
  propertyImageSchema,
  propertySchema,
} from "./schema.js";

const baseProperty = {
  title: "新宿三丁目の路面店",
  slug: "shinjuku-sanchome-street-level",
  address: {
    prefecture: "東京都" as const,
    city: "新宿区",
    streetAddress: "新宿 3-1-1",
    geopoint: { lat: 35.69, lng: 139.7 },
  },
  nearestStations: [{ line: "東京メトロ丸ノ内線", station: "新宿三丁目", walkMinutes: 1 }],
  rent: 480000,
  commonFee: 24000,
  depositMonths: 10,
  keyMoneyMonths: 2,
  area: 33.058,
  buildingType: "street_level" as const,
  condition: "skeleton" as const,
  suitableBusinessRefs: ["category-cafe"],
  images: [],
  description: "明治通り沿いの好立地。",
  features: ["スケルトン", "天井高 3m"],
  availability: "public" as const,
  listedByRef: "company-001",
  aiMeta: { aiExtracted: false },
  publishedAt: "2026-05-01T00:00:00.000Z",
};

describe("propertySchema (有効ケース)", () => {
  it("仕様通りの物件を受け入れる", () => {
    const parsed = propertySchema.parse(baseProperty);
    expect(parsed.title).toBe("新宿三丁目の路面店");
    expect(parsed.nearestStations).toHaveLength(1);
  });

  it("任意フィールド未指定でもパースできる（デフォルト適用）", () => {
    const minimal = {
      title: "ミニマル物件",
      slug: "minimal",
      address: {
        prefecture: "大阪府" as const,
        city: "大阪市",
        geopoint: { lat: 34.7, lng: 135.5 },
      },
      rent: 100000,
      area: 20,
      availability: "public" as const,
      listedByRef: "company-002",
      aiMeta: { aiExtracted: false },
      publishedAt: "2026-05-01T00:00:00.000Z",
    };
    const parsed = propertySchema.parse(minimal);
    expect(parsed.nearestStations).toEqual([]);
    expect(parsed.images).toEqual([]);
    expect(parsed.features).toEqual([]);
    expect(parsed.suitableBusinessRefs).toEqual([]);
  });
});

describe("propertySchema (バリデーション失敗ケース)", () => {
  it("title が空だと拒否", () => {
    expect(() => propertySchema.parse({ ...baseProperty, title: "" })).toThrow();
  });

  it("slug に大文字が含まれると拒否", () => {
    expect(() => propertySchema.parse({ ...baseProperty, slug: "Shinjuku" })).toThrow();
  });

  it("rent が負だと拒否", () => {
    expect(() => propertySchema.parse({ ...baseProperty, rent: -1 })).toThrow();
  });

  it("rent が小数だと拒否", () => {
    expect(() => propertySchema.parse({ ...baseProperty, rent: 100.5 })).toThrow();
  });

  it("area が 0 だと拒否", () => {
    expect(() => propertySchema.parse({ ...baseProperty, area: 0 })).toThrow();
  });

  it("area が 10001 ㎡ だと拒否", () => {
    expect(() => propertySchema.parse({ ...baseProperty, area: 10001 })).toThrow();
  });

  it("depositMonths が 25 だと拒否", () => {
    expect(() => propertySchema.parse({ ...baseProperty, depositMonths: 25 })).toThrow();
  });

  it("publishedAt が ISO 8601 でないと拒否", () => {
    expect(() => propertySchema.parse({ ...baseProperty, publishedAt: "2026-05-01" })).toThrow();
  });

  it("nearestStations が 6 件だと拒否", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      line: `路線${i}`,
      station: `駅${i}`,
      walkMinutes: 5,
    }));
    expect(() => propertySchema.parse({ ...baseProperty, nearestStations: six })).toThrow();
  });

  it("未知のフィールドは strict で拒否", () => {
    expect(() => propertySchema.parse({ ...baseProperty, unknown: "x" })).toThrow();
  });
});

describe("aiExtractionMetaSchema", () => {
  it("aiExtracted=false の場合 aiConfidence なしで受け入れる", () => {
    expect(aiExtractionMetaSchema.parse({ aiExtracted: false })).toEqual({
      aiExtracted: false,
    });
  });

  it("aiExtracted=true で aiConfidence=0.8 を受け入れる", () => {
    expect(aiExtractionMetaSchema.parse({ aiExtracted: true, aiConfidence: 0.8 })).toEqual({
      aiExtracted: true,
      aiConfidence: 0.8,
    });
  });

  it("aiExtracted=true で aiConfidence 無しは拒否", () => {
    expect(() => aiExtractionMetaSchema.parse({ aiExtracted: true })).toThrow();
  });

  it("aiExtracted=false で aiConfidence 指定は拒否", () => {
    expect(() => aiExtractionMetaSchema.parse({ aiExtracted: false, aiConfidence: 0.5 })).toThrow();
  });

  it("aiConfidence が 1.1 だと拒否", () => {
    expect(() => aiExtractionMetaSchema.parse({ aiExtracted: true, aiConfidence: 1.1 })).toThrow();
  });

  it("sourceUrl が URL でないと拒否", () => {
    expect(() =>
      aiExtractionMetaSchema.parse({
        aiExtracted: true,
        aiConfidence: 0.8,
        sourceUrl: "not-a-url",
      }),
    ).toThrow();
  });
});

describe("propertyImageSchema", () => {
  it("Sanity 形式の asset 参照 ID を受け入れる", () => {
    expect(
      propertyImageSchema.parse({
        assetRef: "image-abc123-1024x768-jpg",
        alt: "外観",
        isPrimary: true,
      }),
    ).toBeDefined();
  });

  it("形式違反の assetRef は拒否", () => {
    expect(() => propertyImageSchema.parse({ assetRef: "abc" })).toThrow();
  });
});

describe("derivePropertyTsubo", () => {
  it("33.058 ㎡ は 10.00 坪を持つ派生型を返す", () => {
    const parsed = propertySchema.parse(baseProperty);
    const withTsubo = derivePropertyTsubo(parsed);
    expect(withTsubo.tsubo).toBeCloseTo(10.0, 1);
    expect(withTsubo.area).toBe(33.058);
  });
});
