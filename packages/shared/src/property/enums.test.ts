import { describe, expect, it } from "vitest";
import {
  availabilityLabel,
  availabilitySchema,
  availabilityValues,
  buildingTypeLabel,
  buildingTypeSchema,
  buildingTypeValues,
  conditionLabel,
  conditionSchema,
  conditionValues,
} from "./enums.js";

describe("availability", () => {
  it("public / negotiating / closed のみ受け入れる", () => {
    for (const value of availabilityValues) {
      expect(availabilitySchema.parse(value)).toBe(value);
    }
  });

  it("未知の値は拒否する", () => {
    expect(() => availabilitySchema.parse("unknown")).toThrow();
  });

  it("各値に日本語ラベルが定義されている", () => {
    for (const value of availabilityValues) {
      expect(availabilityLabel[value]).toBeTruthy();
    }
  });
});

describe("buildingType", () => {
  it("6 種類すべてを受け入れる", () => {
    expect(buildingTypeValues).toHaveLength(6);
    for (const value of buildingTypeValues) {
      expect(buildingTypeSchema.parse(value)).toBe(value);
    }
  });

  it("路面店ラベルが日本語で定義されている", () => {
    expect(buildingTypeLabel.street_level).toBe("路面店");
  });

  it("未知の値は拒否する", () => {
    expect(() => buildingTypeSchema.parse("rooftop")).toThrow();
  });
});

describe("condition", () => {
  it("skeleton / second_hand / transferable_fixtures のみ受け入れる", () => {
    for (const value of conditionValues) {
      expect(conditionSchema.parse(value)).toBe(value);
    }
  });

  it("スケルトン / 居抜き / 造作譲渡のラベルが揃う", () => {
    expect(conditionLabel.skeleton).toBe("スケルトン");
    expect(conditionLabel.second_hand).toBe("居抜き");
    expect(conditionLabel.transferable_fixtures).toBe("造作譲渡");
  });

  it("未知の値は拒否する", () => {
    expect(() => conditionSchema.parse("brand_new")).toThrow();
  });
});
