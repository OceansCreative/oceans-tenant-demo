import { z } from "zod";

/**
 * 緯度経度ペア。日本国内の店舗物件を想定し、緯度 20〜46、経度 122〜154 を許容範囲とする。
 */
export const geopointSchema = z
  .object({
    lat: z
      .number()
      .min(20, "緯度は 20 以上である必要があります")
      .max(46, "緯度は 46 以下である必要があります"),
    lng: z
      .number()
      .min(122, "経度は 122 以上である必要があります")
      .max(154, "経度は 154 以下である必要があります"),
  })
  .strict();

export type Geopoint = z.infer<typeof geopointSchema>;

/**
 * 住所。Sanity スキーマ側の object フィールドと対応する。
 *
 * - 都道府県は 47 都道府県のいずれか
 * - 市区町村は必須
 * - 番地（streetAddress）は表記揺れがあるため最大 120 字、任意
 * - 建物名・部屋番号は別フィールド
 */
export const prefectureValues = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;
export const prefectureSchema = z.enum(prefectureValues);
export type Prefecture = z.infer<typeof prefectureSchema>;

export const addressSchema = z
  .object({
    prefecture: prefectureSchema,
    city: z.string().min(1, "市区町村は必須です").max(80),
    streetAddress: z.string().max(120).optional(),
    buildingName: z.string().max(120).optional(),
    roomNumber: z.string().max(40).optional(),
    geopoint: geopointSchema,
  })
  .strict();

export type Address = z.infer<typeof addressSchema>;

/**
 * 最寄り駅。1 物件に複数登録できる。
 *
 * - line: 路線名（例: "JR 山手線"）
 * - station: 駅名（例: "新宿"）
 * - walkMinutes: 徒歩分。0〜60 を許容
 */
export const nearestStationSchema = z
  .object({
    line: z.string().min(1).max(60),
    station: z.string().min(1).max(40),
    walkMinutes: z
      .number()
      .int("徒歩分は整数で指定してください")
      .min(0, "徒歩分は 0 以上である必要があります")
      .max(60, "徒歩分は 60 以下である必要があります"),
  })
  .strict();

export type NearestStation = z.infer<typeof nearestStationSchema>;
