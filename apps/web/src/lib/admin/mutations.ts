import { type Property, propertySchema } from "@oceans-tenant/shared";
import {
  deleteMockProperty,
  getMockPropertyBySlug,
  listMockProperties,
  upsertMockProperty,
} from "@/lib/admin/mock-store";
import { getSanityWriteClient } from "@/lib/admin/sanity-write";

/**
 * 物件 mutation の中心ロジック。
 *
 * - `getSanityWriteClient()` が `null` なら mock store にフォールバック
 * - それ以外なら `createOrReplace` / `delete` で実 Sanity に反映
 * - 入力は **必ず** `propertySchema.parse` を通してから持ち回り、壊れたデータが
 *   下流に流れないようにする
 *
 * v0.10.0 WS-1 では admin UI からのみ呼ばれる前提。将来的に AI 抽出フローからも
 * 同じ関数を共有できるようインタフェースを最小化している。
 *
 * @remarks
 *   Sanity の `_id` は `property-<slug>` 形式で構築する。`createOrReplace` を使うため
 *   既存ドキュメントがあれば上書き、無ければ新規作成される（idempotent）。
 */

export type UpsertPropertyResult = {
  readonly status: "ok";
  readonly mode: "sanity" | "mock";
  readonly property: Property;
};

export type DeletePropertyResult = {
  readonly status: "ok";
  readonly mode: "sanity" | "mock";
  readonly slug: string;
};

const buildSanityDocumentId = (slug: string): string => `property-${slug}`;

/**
 * 物件を upsert する。Sanity 接続があれば `createOrReplace`、無ければ mock store に保存。
 *
 * 既存ドキュメントを更新する場合も新規作成する場合も同じインタフェースで使える。
 * 戻り値の `mode` で呼び出し側がトーストの文言を出し分けられるようにしている。
 */
export const upsertProperty = async (input: unknown): Promise<UpsertPropertyResult> => {
  const property = propertySchema.parse(input);

  const client = getSanityWriteClient();
  if (!client) {
    upsertMockProperty(property);
    return { status: "ok", mode: "mock", property };
  }

  await client.createOrReplace({
    _id: buildSanityDocumentId(property.slug),
    _type: "property",
    ...property,
  });
  return { status: "ok", mode: "sanity", property };
};

/**
 * 物件を削除する。Sanity 接続があれば `delete`、無ければ mock store から削除。
 */
export const deleteProperty = async (slug: string): Promise<DeletePropertyResult> => {
  if (!slug) {
    throw new Error("slug は必須です");
  }
  const client = getSanityWriteClient();
  if (!client) {
    deleteMockProperty(slug);
    return { status: "ok", mode: "mock", slug };
  }

  await client.delete(buildSanityDocumentId(slug));
  return { status: "ok", mode: "sanity", slug };
};

/**
 * Admin 一覧表示用に物件を返す。mock fallback のみ対応（実 Sanity 接続時は
 * 既存の `fetchProperties()` 経路を共有して GROQ で取得すべきだが、
 * v0.10.0 WS-1 では mock store 経路のみ確定実装する）。
 */
export const listPropertiesForAdmin = (): ReadonlyArray<Property> => listMockProperties();

export const getPropertyForAdmin = (slug: string): Property | null => getMockPropertyBySlug(slug);
