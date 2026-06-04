import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sanity 書き込みクライアントの env 切替テスト。
 *
 * - `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` / `SANITY_API_TOKEN`
 *   のいずれか一つでも欠ければ `null` を返す
 * - 揃っている場合は `useCdn: false` で `createClient` が呼ばれる（書き込みは CDN 不可）
 */

type CreateClientArg = {
  projectId: string;
  dataset: string;
  apiVersion: string;
  token: string;
  useCdn: boolean;
};

const createClientMock = vi.fn<(config: CreateClientArg) => { __writeMock: true }>(() => ({
  __writeMock: true,
}));

vi.mock("@sanity/client", () => ({
  createClient: (config: CreateClientArg) => createClientMock(config),
}));

const stubAll = () => {
  vi.stubEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "write-project");
  vi.stubEnv("NEXT_PUBLIC_SANITY_DATASET", "write-dataset");
  vi.stubEnv("SANITY_API_TOKEN", "write-token");
};

const clearAll = () => {
  vi.stubEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "");
  vi.stubEnv("NEXT_PUBLIC_SANITY_DATASET", "");
  vi.stubEnv("SANITY_API_TOKEN", "");
};

const loadModule = async (): Promise<typeof import("../sanity-write")> => {
  vi.resetModules();
  return import("../sanity-write");
};

beforeEach(() => {
  createClientMock.mockClear();
  clearAll();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSanityWriteClient", () => {
  it("env 三点セットが揃っていれば SanityClient を返し、useCdn:false で呼ぶ", async () => {
    stubAll();
    const { getSanityWriteClient } = await loadModule();
    const client = getSanityWriteClient();
    expect(client).not.toBeNull();
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const lastCall = createClientMock.mock.calls.at(-1)?.[0];
    expect(lastCall?.projectId).toBe("write-project");
    expect(lastCall?.dataset).toBe("write-dataset");
    expect(lastCall?.token).toBe("write-token");
    expect(lastCall?.useCdn).toBe(false);
  });

  it("SANITY_API_TOKEN が無ければ null", async () => {
    stubAll();
    vi.stubEnv("SANITY_API_TOKEN", "");
    const { getSanityWriteClient } = await loadModule();
    expect(getSanityWriteClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("NEXT_PUBLIC_SANITY_PROJECT_ID が無ければ null", async () => {
    stubAll();
    vi.stubEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "");
    const { getSanityWriteClient } = await loadModule();
    expect(getSanityWriteClient()).toBeNull();
  });

  it("env が一切無ければ null", async () => {
    const { getSanityWriteClient } = await loadModule();
    expect(getSanityWriteClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
