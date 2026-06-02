import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sanity 実接続クライアントの env 切替テスト。
 *
 * `@sanity/client` の `createClient` 自体は副作用のないファクトリで、env が揃っていれば
 * 必ず呼ばれることだけを保証する（実 HTTP は飛ばない）。env 欠落時に null を返す
 * フォールバック挙動が壊れていないことを最優先で検証する。
 *
 * NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_READ_TOKEN の
 * いずれか一つでも欠ければ null。
 */

type CreateClientArg = {
  projectId: string;
  dataset: string;
  apiVersion: string;
  token: string;
  useCdn: boolean;
};

const createClientMock = vi.fn<(config: CreateClientArg) => { __mock: true }>(() => ({
  __mock: true,
}));

vi.mock("@sanity/client", () => ({
  createClient: (config: CreateClientArg) => createClientMock(config),
}));

const stubAll = () => {
  vi.stubEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "test-project");
  vi.stubEnv("NEXT_PUBLIC_SANITY_DATASET", "test-dataset");
  vi.stubEnv("SANITY_API_READ_TOKEN", "test-token");
};

const clearAll = () => {
  vi.stubEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "");
  vi.stubEnv("NEXT_PUBLIC_SANITY_DATASET", "");
  vi.stubEnv("SANITY_API_READ_TOKEN", "");
};

const loadModule = async (): Promise<typeof import("../client")> => {
  vi.resetModules();
  return import("../client");
};

beforeEach(() => {
  createClientMock.mockClear();
  clearAll();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSanityClient", () => {
  it("env が全て揃っていれば SanityClient を返し、createClient へ正しい引数を渡す", async () => {
    stubAll();
    const { getSanityClient, SANITY_API_VERSION } = await loadModule();
    const client = getSanityClient();
    expect(client).not.toBeNull();
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith({
      projectId: "test-project",
      dataset: "test-dataset",
      apiVersion: SANITY_API_VERSION,
      token: "test-token",
      useCdn: true,
    });
  });

  it("useCdn は true で固定（公開クエリ高速化）", async () => {
    stubAll();
    const { getSanityClient } = await loadModule();
    getSanityClient();
    const lastCall = createClientMock.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const config = lastCall?.[0];
    expect(config?.useCdn).toBe(true);
  });

  it("apiVersion は固定日付（後方互換性のため）", async () => {
    stubAll();
    const { getSanityClient, SANITY_API_VERSION } = await loadModule();
    getSanityClient();
    const lastCall = createClientMock.mock.calls.at(-1);
    expect(lastCall?.[0]?.apiVersion).toBe(SANITY_API_VERSION);
    // 形式: YYYY-MM-DD
    expect(SANITY_API_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("NEXT_PUBLIC_SANITY_PROJECT_ID が無ければ null", async () => {
    stubAll();
    vi.stubEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "");
    const { getSanityClient } = await loadModule();
    expect(getSanityClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("NEXT_PUBLIC_SANITY_DATASET が無ければ null", async () => {
    stubAll();
    vi.stubEnv("NEXT_PUBLIC_SANITY_DATASET", "");
    const { getSanityClient } = await loadModule();
    expect(getSanityClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("SANITY_API_READ_TOKEN が無ければ null", async () => {
    stubAll();
    vi.stubEnv("SANITY_API_READ_TOKEN", "");
    const { getSanityClient } = await loadModule();
    expect(getSanityClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("env が一切なければ null（既存 mock 経路を維持）", async () => {
    const { getSanityClient } = await loadModule();
    expect(getSanityClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
