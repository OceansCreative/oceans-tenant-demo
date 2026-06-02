import type { Availability, BuildingType, Condition } from "@oceans-tenant/shared";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

/**
 * 物件まわりの enum → 表示文字列の locale 対応 helper。
 *
 * `@oceans-tenant/shared` の `availabilityLabel` / `buildingTypeLabel` / `conditionLabel`
 * は ja 固定のため、Web 表示では本ファイルの helper を経由して `messages/{ja,en}.json`
 * の `enum.*` 名前空間から引く。shared 側のラベルはエラーメッセージや CMS シードなど
 * Web 以外の用途で引き続き利用される。
 *
 * Server Component から呼ぶ場合は `createEnumLabelLookupAsync()` を、
 * Client Component から呼ぶ場合は `useEnumLabelLookup()` を使う。
 * いずれも同じ API（`(value) => string`）を返すので呼び出し側は透過的に扱える。
 */

export type EnumLabelLookup = {
  readonly availability: (value: Availability) => string;
  readonly buildingType: (value: BuildingType) => string;
  readonly condition: (value: Condition) => string;
};

/**
 * Server Component / API Route 用の非同期 factory。
 *
 * `getTranslations()` を一度だけ実行し、3 種の lookup 関数を返す。
 * 同一 RSC レンダリング中なら何度呼んでも cheap（next-intl が内部キャッシュする）が、
 * 呼び出し側で 1 つにまとめておくと再帰呼び出し時にも安全。
 */
export const createEnumLabelLookupAsync = async (): Promise<EnumLabelLookup> => {
  const [tAvailability, tBuildingType, tCondition] = await Promise.all([
    getTranslations("enum.availability"),
    getTranslations("enum.buildingType"),
    getTranslations("enum.condition"),
  ]);
  return {
    availability: (value) => tAvailability(value),
    buildingType: (value) => tBuildingType(value),
    condition: (value) => tCondition(value),
  };
};

/**
 * Client Component 用 hook 版。
 *
 * `useTranslations()` を 3 つの名前空間でフックする。フック内で呼ぶため、
 * 通常の React hook ルールに従い、コンポーネント本体のトップレベルから呼ぶこと。
 */
export const useEnumLabelLookup = (): EnumLabelLookup => {
  const tAvailability = useTranslations("enum.availability");
  const tBuildingType = useTranslations("enum.buildingType");
  const tCondition = useTranslations("enum.condition");
  return {
    availability: (value) => tAvailability(value),
    buildingType: (value) => tBuildingType(value),
    condition: (value) => tCondition(value),
  };
};
