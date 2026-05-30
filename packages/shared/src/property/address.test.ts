import { describe, expect, it } from "vitest";
import {
  addressSchema,
  geopointSchema,
  nearestStationSchema,
  prefectureSchema,
} from "./address.js";

describe("geopointSchema", () => {
  it("東京駅の緯度経度を受け入れる", () => {
    expect(geopointSchema.parse({ lat: 35.681236, lng: 139.767125 })).toEqual({
      lat: 35.681236,
      lng: 139.767125,
    });
  });

  it("緯度 19 は範囲外で拒否", () => {
    expect(() => geopointSchema.parse({ lat: 19, lng: 140 })).toThrow();
  });

  it("緯度 47 は範囲外で拒否", () => {
    expect(() => geopointSchema.parse({ lat: 47, lng: 140 })).toThrow();
  });

  it("経度 121 は範囲外で拒否", () => {
    expect(() => geopointSchema.parse({ lat: 35, lng: 121 })).toThrow();
  });

  it("追加プロパティは拒否（strict）", () => {
    expect(() => geopointSchema.parse({ lat: 35, lng: 140, alt: 100 })).toThrow();
  });
});

describe("prefectureSchema", () => {
  it("47 都道府県をすべて含む", () => {
    expect(prefectureSchema.options).toHaveLength(47);
  });

  it("東京都を受け入れる", () => {
    expect(prefectureSchema.parse("東京都")).toBe("東京都");
  });

  it("北海道を受け入れる", () => {
    expect(prefectureSchema.parse("北海道")).toBe("北海道");
  });

  it("存在しない都道府県は拒否", () => {
    expect(() => prefectureSchema.parse("江戸府")).toThrow();
  });
});

describe("addressSchema", () => {
  const valid = {
    prefecture: "東京都" as const,
    city: "新宿区",
    streetAddress: "西新宿 1-1-1",
    buildingName: "新宿センタービル",
    roomNumber: "1F",
    geopoint: { lat: 35.689, lng: 139.692 },
  };

  it("完全な住所を受け入れる", () => {
    expect(addressSchema.parse(valid)).toEqual(valid);
  });

  it("buildingName / roomNumber / streetAddress は任意", () => {
    const minimal = {
      prefecture: "大阪府" as const,
      city: "大阪市北区",
      geopoint: { lat: 34.7, lng: 135.5 },
    };
    expect(addressSchema.parse(minimal)).toEqual(minimal);
  });

  it("city が空文字だと拒否", () => {
    expect(() => addressSchema.parse({ ...valid, city: "" })).toThrow();
  });

  it("geopoint が無いと拒否", () => {
    const { geopoint: _omit, ...rest } = valid;
    expect(() => addressSchema.parse(rest)).toThrow();
  });
});

describe("nearestStationSchema", () => {
  it("有効な最寄り駅を受け入れる", () => {
    expect(
      nearestStationSchema.parse({
        line: "JR 山手線",
        station: "新宿",
        walkMinutes: 5,
      }),
    ).toBeDefined();
  });

  it("徒歩分が小数だと拒否", () => {
    expect(() =>
      nearestStationSchema.parse({
        line: "JR 山手線",
        station: "新宿",
        walkMinutes: 5.5,
      }),
    ).toThrow();
  });

  it("徒歩分が 61 だと拒否", () => {
    expect(() =>
      nearestStationSchema.parse({
        line: "JR 山手線",
        station: "新宿",
        walkMinutes: 61,
      }),
    ).toThrow();
  });

  it("徒歩分が負だと拒否", () => {
    expect(() =>
      nearestStationSchema.parse({
        line: "JR 山手線",
        station: "新宿",
        walkMinutes: -1,
      }),
    ).toThrow();
  });
});
