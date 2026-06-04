import type { Property } from "@oceans-tenant/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `upsertProperty` / `deleteProperty` の mode 切替テスト。
 *
 * - `getSanityWriteClient()` が `null` を返すなら mock fallback（mock store に保存）
 * - `null` 以外なら `createOrReplace` / `delete` を呼んで mode: "sanity" を返す
 * - 入力検証は propertySchema を通してから持ち回る
 */

const buildValidProperty = (overrides: Partial<Property> = {}): Property => ({
  title: "テスト物件",
  slug: "test-mutation",
  address: {
    prefecture: "東京都",
    city: "新宿区",
    geopoint: { lat: 35.69, lng: 139.7 },
  },
  nearestStations: [],
  rent: 250000,
  area: 22,
  suitableBusinessRefs: [],
  images: [],
  features: [],
  availability: "public",
  listedByRef: "company-001",
  aiMeta: { aiExtracted: false },
  publishedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

const createOrReplaceMock = vi.fn(async () => ({ _id: "property-test-mutation" }));
const deleteMock = vi.fn(async () => ({ documentId: "property-test-mutation" }));
const getSanityWriteClientMock = vi.fn<() => unknown>(() => null);

vi.mock("@/lib/admin/sanity-write", () => ({
  getSanityWriteClient: () => getSanityWriteClientMock(),
}));

beforeEach(async () => {
  vi.resetModules();
  createOrReplaceMock.mockClear();
  deleteMock.mockClear();
  getSanityWriteClientMock.mockReset();
  getSanityWriteClientMock.mockReturnValue(null);
  const { __resetAdminMockStoreForTesting } = await import("../mock-store");
  __resetAdminMockStoreForTesting();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("upsertProperty", () => {
  it("write client が null のとき mock fallback で保存し mode:'mock' を返す", async () => {
    const { upsertProperty } = await import("../mutations");
    const result = await upsertProperty(buildValidProperty());
    expect(result.status).toBe("ok");
    expect(result.mode).toBe("mock");
    expect(result.property.slug).toBe("test-mutation");
    expect(createOrReplaceMock).not.toHaveBeenCalled();
  });

  it("write client が存在するときは createOrReplace を呼び mode:'sanity' を返す", async () => {
    getSanityWriteClientMock.mockReturnValue({ createOrReplace: createOrReplaceMock });
    const { upsertProperty } = await import("../mutations");
    const result = await upsertProperty(buildValidProperty());
    expect(result.mode).toBe("sanity");
    expect(createOrReplaceMock).toHaveBeenCalledTimes(1);
    // vi.fn() の `mock.calls` は `unknown[][]` 相当のため、unknown 経由で具体型に絞る
    const lastCall = createOrReplaceMock.mock.calls.at(-1);
    if (!lastCall) throw new Error("createOrReplace が呼ばれていない");
    const arg = lastCall[0] as unknown as { _id: string; _type: string };
    expect(arg._id).toBe("property-test-mutation");
    expect(arg._type).toBe("property");
  });

  it("検証エラーを投げる（入力が schema に合わない）", async () => {
    const { upsertProperty } = await import("../mutations");
    await expect(upsertProperty({ ...buildValidProperty(), rent: -1 })).rejects.toThrow();
  });
});

describe("deleteProperty", () => {
  it("write client が null のとき mock fallback で削除し mode:'mock' を返す", async () => {
    const { upsertProperty, deleteProperty } = await import("../mutations");
    await upsertProperty(buildValidProperty());
    const result = await deleteProperty("test-mutation");
    expect(result.mode).toBe("mock");
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("write client が存在するときは delete を呼び mode:'sanity' を返す", async () => {
    getSanityWriteClientMock.mockReturnValue({
      createOrReplace: createOrReplaceMock,
      delete: deleteMock,
    });
    const { deleteProperty } = await import("../mutations");
    const result = await deleteProperty("test-mutation");
    expect(result.mode).toBe("sanity");
    expect(deleteMock).toHaveBeenCalledWith("property-test-mutation");
  });

  it("空 slug は throw", async () => {
    const { deleteProperty } = await import("../mutations");
    await expect(deleteProperty("")).rejects.toThrow();
  });
});
