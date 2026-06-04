import { type Property, propertySchema } from "@oceans-tenant/shared";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

/**
 * Admin の mock fallback 用 in-memory store。
 *
 * 設計判断:
 * - **永続化しない**: プロセスメモリのみで保持し、Next.js のサーバ再起動 / 別 region には伝搬しない。
 *   デモ環境では「保存」体験ができれば十分で、Sanity を繋いだ瞬間に実 DB に切り替わる前提。
 * - **slug を主キー**: 物件詳細ページ (`/properties/[slug]`) と整合させるため。Sanity 側の `_id` は
 *   保存後に確定するため、admin UI ではユーザーが入力する slug を識別子として使う。
 * - **初期データは MOCK_PROPERTIES から複製**: 起動直後でも一覧 / 編集 UI を試せる体験を提供する。
 *   元配列は read-only なため `structuredClone` でディープコピーする。
 *
 * **重要**: localStorage / sessionStorage は使用禁止（CLAUDE.md）。
 * server-side のメモリのみで保持する。
 */

type Store = Map<string, Property>;

let store: Store | null = null;

const cloneInitialData = (): Store => {
  const initial: Store = new Map();
  for (const property of MOCK_PROPERTIES) {
    // `MOCK_PROPERTIES` は `PropertyWithTsubo`。`tsubo` は派生値なので保存対象から外す。
    const { tsubo: _tsubo, ...rest } = property;
    initial.set(property.slug, structuredClone(rest));
  }
  return initial;
};

const getStore = (): Store => {
  if (store === null) {
    store = cloneInitialData();
  }
  return store;
};

/**
 * テスト用に store を初期状態にリセット。プロダクションコードから呼ばないこと。
 */
export const __resetAdminMockStoreForTesting = (): void => {
  store = null;
};

/**
 * mock store の全件を読み取り順で取得する。
 *
 * publishedAt 降順で並べることで、admin 一覧 UI で新しい物件が上に出るようにする。
 */
export const listMockProperties = (): ReadonlyArray<Property> => {
  const all = Array.from(getStore().values());
  return [...all].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
};

export const getMockPropertyBySlug = (slug: string): Property | null => {
  return getStore().get(slug) ?? null;
};

/**
 * mock store に property を upsert する。`propertySchema.parse` で防御的に検証してから保存する。
 *
 * @returns 保存された property（検証済み）
 * @throws Zod 検証エラーをそのまま投げる（呼び出し側で 400 へ写像する）
 */
export const upsertMockProperty = (input: unknown): Property => {
  const parsed = propertySchema.parse(input);
  getStore().set(parsed.slug, parsed);
  return parsed;
};

export const deleteMockProperty = (slug: string): boolean => {
  return getStore().delete(slug);
};
