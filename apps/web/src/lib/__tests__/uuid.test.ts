import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateUuidV4 } from "@/lib/uuid";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateUuidV4", () => {
  it("UUID v4 形式の文字列を返す（crypto.randomUUID あり）", () => {
    const id = generateUuidV4();
    expect(id).toMatch(UUID_V4_PATTERN);
  });

  it("crypto.randomUUID を呼び出す", () => {
    const originalCrypto = globalThis.crypto;
    const spy = vi.fn(() => "00000000-0000-4000-8000-000000000000" as const);
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: spy },
      configurable: true,
    });
    expect(generateUuidV4()).toBe("00000000-0000-4000-8000-000000000000");
    expect(spy).toHaveBeenCalled();
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
    });
  });

  describe("crypto.randomUUID がない環境（getRandomValues のみ）のフォールバック", () => {
    let originalCrypto: Crypto;

    beforeEach(() => {
      originalCrypto = globalThis.crypto;
      // randomUUID は無く getRandomValues のみある環境を模倣（古いブラウザ / 一部 jsdom 等）
      Object.defineProperty(globalThis, "crypto", {
        value: {
          getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
            if (array instanceof Uint8Array) {
              for (let i = 0; i < array.length; i++) {
                // 0-255 の擬似乱数。crypto としては真乱数だが、テストでは決定論的でなくて構わない
                array[i] = Math.floor(originalCrypto.getRandomValues(new Uint8Array(1))[0] ?? 0);
              }
            }
            return array;
          },
        },
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
      });
    });

    it("UUID v4 形式の文字列を返す（getRandomValues 経由）", () => {
      const id = generateUuidV4();
      expect(id).toMatch(UUID_V4_PATTERN);
    });

    it("毎回ユニークな値を返す（10 回で重複しない）", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) ids.add(generateUuidV4());
      expect(ids.size).toBe(10);
    });
  });

  describe("crypto API そのものが無い環境", () => {
    let originalCrypto: Crypto;

    beforeEach(() => {
      originalCrypto = globalThis.crypto;
      Object.defineProperty(globalThis, "crypto", {
        value: undefined,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
      });
    });

    it("Math.random フォールバックは廃止されたため明示的に throw する", () => {
      expect(() => generateUuidV4()).toThrow(/crypto/);
    });
  });
});
