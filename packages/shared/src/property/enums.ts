import { z } from "zod";

/**
 * 物件の公開状態。
 * - public: 公開中
 * - negotiating: 商談中（指値中・申込中含む）
 * - closed: 成約（非公開化）
 */
export const availabilityValues = ["public", "negotiating", "closed"] as const;
export const availabilitySchema = z.enum(availabilityValues);
export type Availability = z.infer<typeof availabilitySchema>;

export const availabilityLabel: Readonly<Record<Availability, string>> = {
  public: "公開中",
  negotiating: "商談中",
  closed: "成約",
};

/**
 * 建物形態。路面店 / ビルイン / 居抜きビルなど。
 */
export const buildingTypeValues = [
  "street_level",
  "building_inline",
  "second_floor_or_above",
  "basement",
  "stand_alone",
  "other",
] as const;
export const buildingTypeSchema = z.enum(buildingTypeValues);
export type BuildingType = z.infer<typeof buildingTypeSchema>;

export const buildingTypeLabel: Readonly<Record<BuildingType, string>> = {
  street_level: "路面店",
  building_inline: "ビルイン",
  second_floor_or_above: "2 階以上",
  basement: "地下",
  stand_alone: "独立店舗",
  other: "その他",
};

/**
 * 物件の状態。スケルトン / 居抜き / 造作譲渡。
 */
export const conditionValues = ["skeleton", "second_hand", "transferable_fixtures"] as const;
export const conditionSchema = z.enum(conditionValues);
export type Condition = z.infer<typeof conditionSchema>;

export const conditionLabel: Readonly<Record<Condition, string>> = {
  skeleton: "スケルトン",
  second_hand: "居抜き",
  transferable_fixtures: "造作譲渡",
};
