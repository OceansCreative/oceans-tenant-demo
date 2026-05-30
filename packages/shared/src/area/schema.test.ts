import { describe, expect, it } from "vitest";
import { areaSchema } from "./schema.js";

const baseArea = {
  name: "新宿",
  slug: "shinjuku",
  prefecture: "東京都" as const,
  city: "新宿区",
  coordinates: { lat: 35.6938, lng: 139.7036 },
};

describe("areaSchema (有効ケース)", () => {
  it("最小構成のエリアを受け入れる", () => {
    expect(areaSchema.parse(baseArea).name).toBe("新宿");
  });

  it("district 付きで受け入れる", () => {
    expect(areaSchema.parse({ ...baseArea, district: "西新宿" }).district).toBe("西新宿");
  });

  it("parentAreaRef 付きで受け入れる", () => {
    expect(areaSchema.parse({ ...baseArea, parentAreaRef: "area-tokyo" }).parentAreaRef).toBe(
      "area-tokyo",
    );
  });

  it("sortOrder=0 を受け入れる", () => {
    expect(areaSchema.parse({ ...baseArea, sortOrder: 0 }).sortOrder).toBe(0);
  });
});

describe("areaSchema (失敗ケース)", () => {
  it("name が空だと拒否", () => {
    expect(() => areaSchema.parse({ ...baseArea, name: "" })).toThrow();
  });

  it("slug に大文字があると拒否", () => {
    expect(() => areaSchema.parse({ ...baseArea, slug: "Shinjuku" })).toThrow();
  });

  it("city が空だと拒否", () => {
    expect(() => areaSchema.parse({ ...baseArea, city: "" })).toThrow();
  });

  it("coordinates が日本範囲外だと拒否", () => {
    expect(() =>
      areaSchema.parse({
        ...baseArea,
        coordinates: { lat: 0, lng: 0 },
      }),
    ).toThrow();
  });

  it("存在しない都道府県は拒否", () => {
    expect(() => areaSchema.parse({ ...baseArea, prefecture: "江戸府" })).toThrow();
  });

  it("parentAreaRef に空白が含まれると拒否", () => {
    expect(() => areaSchema.parse({ ...baseArea, parentAreaRef: "invalid id" })).toThrow();
  });

  it("sortOrder が負だと拒否", () => {
    expect(() => areaSchema.parse({ ...baseArea, sortOrder: -1 })).toThrow();
  });

  it("未知フィールドは strict で拒否", () => {
    expect(() => areaSchema.parse({ ...baseArea, unknownField: "x" })).toThrow();
  });
});
