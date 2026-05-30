import { describe, expect, it } from "vitest";
import { squareMeterToTsubo, tsuboToSquareMeter } from "./tsubo.js";

describe("squareMeterToTsubo", () => {
  it("33.058 ㎡ は約 10 坪", () => {
    expect(squareMeterToTsubo(33.058)).toBeCloseTo(10.0, 1);
  });

  it("0 ㎡ は 0 坪", () => {
    expect(squareMeterToTsubo(0)).toBe(0);
  });

  it("100 ㎡ は 30.25 坪（小数 2 桁）", () => {
    expect(squareMeterToTsubo(100)).toBe(30.25);
  });

  it("fractionDigits=0 で整数に丸める", () => {
    expect(squareMeterToTsubo(100, 0)).toBe(30);
  });

  it("fractionDigits=4 で小数 4 桁まで残す", () => {
    expect(squareMeterToTsubo(33.058, 4)).toBe(10.0);
  });

  it("負値は RangeError", () => {
    expect(() => squareMeterToTsubo(-1)).toThrow(RangeError);
  });

  it("NaN は RangeError", () => {
    expect(() => squareMeterToTsubo(Number.NaN)).toThrow(RangeError);
  });

  it("Infinity は RangeError", () => {
    expect(() => squareMeterToTsubo(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("fractionDigits が負だと RangeError", () => {
    expect(() => squareMeterToTsubo(100, -1)).toThrow(RangeError);
  });

  it("fractionDigits が非整数だと RangeError", () => {
    expect(() => squareMeterToTsubo(100, 1.5)).toThrow(RangeError);
  });
});

describe("tsuboToSquareMeter", () => {
  it("10 坪は約 33.06 ㎡", () => {
    expect(tsuboToSquareMeter(10)).toBeCloseTo(33.06, 1);
  });

  it("0 坪は 0 ㎡", () => {
    expect(tsuboToSquareMeter(0)).toBe(0);
  });

  it("負値は RangeError", () => {
    expect(() => tsuboToSquareMeter(-1)).toThrow(RangeError);
  });

  it("往復換算で誤差が 0.1 ㎡ 未満", () => {
    const original = 50;
    const roundTrip = tsuboToSquareMeter(squareMeterToTsubo(original, 4), 4);
    expect(Math.abs(roundTrip - original)).toBeLessThan(0.1);
  });
});
