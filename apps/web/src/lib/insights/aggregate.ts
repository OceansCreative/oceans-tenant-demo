import {
  type Availability,
  type BuildingType,
  buildingTypeValues,
  type Condition,
  conditionValues,
  type PropertyWithTsubo,
} from "@oceans-tenant/shared";

/**
 * 物件統計ダッシュボード（/insights）の集計ロジック。
 *
 * - すべて property 配列 → 集計結果の pure 関数として実装する
 * - 引数の `properties` は呼び出し側で `fetchProperties()` を経由して得る前提
 *   （mock / Sanity 実接続の双方で同じインターフェースで動かせる）
 * - グラフ描画 (recharts) に直接渡せる形へ整形するヘルパも合わせて提供する
 *
 * 設計上の前提:
 * - 「件数 0」のキーも返す（chart が「カテゴリ自体は存在するが 0 件」を表現できるように）
 * - 賃料ヒストグラムの bin サイズは引数で指定可能（mock 5 件 / 本番大量データ どちらも扱える）
 * - 入力が空配列の場合も例外を投げず、すべて 0 件 / 0 円 / 0 ㎡ で返す
 */

export type BuildingTypeBucket = {
  readonly key: BuildingType;
  readonly count: number;
};

export type PrefectureBucket = {
  readonly prefecture: string;
  readonly count: number;
};

export type ConditionBucket = {
  readonly key: Condition;
  readonly count: number;
};

export type RentHistogramBin = {
  readonly min: number;
  readonly max: number;
  readonly count: number;
};

export type KpiSummary = {
  readonly total: number;
  readonly avgRent: number;
  readonly avgArea: number;
  readonly publishingCount: number;
};

const PUBLIC_AVAILABILITY: Availability = "public";

/**
 * 業態（building type）別の件数集計。
 *
 * `buildingTypeValues` の全キーを 0 件込みで返し、Pie / Donut Chart のスロット欠落を防ぐ。
 * 物件側で `buildingType` が `undefined` のものは集計対象外（型上は optional）。
 */
export const aggregatePropertiesByBuildingType = (
  properties: ReadonlyArray<PropertyWithTsubo>,
): ReadonlyArray<BuildingTypeBucket> => {
  const counts: Record<BuildingType, number> = {
    street_level: 0,
    building_inline: 0,
    second_floor_or_above: 0,
    basement: 0,
    stand_alone: 0,
    other: 0,
  };
  for (const property of properties) {
    if (property.buildingType) {
      counts[property.buildingType] += 1;
    }
  }
  return buildingTypeValues.map((key) => ({ key, count: counts[key] }));
};

/**
 * 都道府県別の件数集計。
 *
 * 出現した都道府県のみを返し、件数の多い順 → 同数は名前の昇順で安定ソートする。
 * 47 都道府県すべてを 0 件で埋めると bar chart が極端に縦長になるため、出現分のみを採用。
 */
export const aggregateByPrefecture = (
  properties: ReadonlyArray<PropertyWithTsubo>,
): ReadonlyArray<PrefectureBucket> => {
  const counts = new Map<string, number>();
  for (const property of properties) {
    const prefecture = property.address.prefecture;
    counts.set(prefecture, (counts.get(prefecture) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([prefecture, count]) => ({ prefecture, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.prefecture.localeCompare(b.prefecture, "ja");
    });
};

/**
 * 賃料ヒストグラム。
 *
 * - `binSize` は円単位（デフォルト 50,000 円刻み）
 * - 最小値を 0 に固定し、最大賃料を含む bin まで生成する
 * - 0 件 bin も返す（ヒストグラムの空白を許容しないため）
 * - 物件が 1 件もない場合は空配列を返す（呼び出し側で「データなし」表示に分岐）
 */
export const histogramRent = (
  properties: ReadonlyArray<PropertyWithTsubo>,
  binSize = 50_000,
): ReadonlyArray<RentHistogramBin> => {
  if (binSize <= 0) {
    throw new Error("binSize は正の数である必要があります");
  }
  if (properties.length === 0) return [];

  const maxRent = properties.reduce((max, property) => Math.max(max, property.rent), 0);
  const binCount = Math.floor(maxRent / binSize) + 1;
  const bins: RentHistogramBin[] = Array.from({ length: binCount }, (_, index) => ({
    min: index * binSize,
    max: (index + 1) * binSize,
    count: 0,
  }));

  // Bucket index は最大 binCount-1 にクランプ（max == binSize * n のとき index が範囲外になるのを防ぐ）
  for (const property of properties) {
    const rawIndex = Math.floor(property.rent / binSize);
    const index = Math.min(rawIndex, binCount - 1);
    const bin = bins[index];
    if (bin) {
      bins[index] = { min: bin.min, max: bin.max, count: bin.count + 1 };
    }
  }
  return bins;
};

/**
 * 物件状態（スケルトン / 居抜き / 造作譲渡）の件数集計。
 *
 * `conditionValues` の全キーを 0 件込みで返す。
 * 物件側で `condition` が undefined のものは集計対象外（型上は optional）。
 */
export const aggregateByCondition = (
  properties: ReadonlyArray<PropertyWithTsubo>,
): ReadonlyArray<ConditionBucket> => {
  const counts: Record<Condition, number> = {
    skeleton: 0,
    second_hand: 0,
    transferable_fixtures: 0,
  };
  for (const property of properties) {
    if (property.condition) {
      counts[property.condition] += 1;
    }
  }
  return conditionValues.map((key) => ({ key, count: counts[key] }));
};

/**
 * KPI カード用のサマリ。
 *
 * - total: 物件総数
 * - avgRent: 平均賃料（小数点以下は四捨五入で整数化、円単位）
 * - avgArea: 平均面積（小数点 1 位）
 * - publishingCount: availability === "public" の件数
 *
 * 0 件入力時はすべて 0 で返す。
 */
export const computeKpis = (properties: ReadonlyArray<PropertyWithTsubo>): KpiSummary => {
  if (properties.length === 0) {
    return { total: 0, avgRent: 0, avgArea: 0, publishingCount: 0 };
  }
  const totalRent = properties.reduce((sum, property) => sum + property.rent, 0);
  const totalArea = properties.reduce((sum, property) => sum + property.area, 0);
  const publishingCount = properties.filter(
    (property) => property.availability === PUBLIC_AVAILABILITY,
  ).length;
  return {
    total: properties.length,
    avgRent: Math.round(totalRent / properties.length),
    avgArea: Math.round((totalArea / properties.length) * 10) / 10,
    publishingCount,
  };
};
