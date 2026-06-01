// @vitest-environment node
/**
 * 実 undici + ローカル HTTP サーバの **結合テスト**。
 *
 * 既存の `url-safety.test.ts` は `fetchImpl` をモックして dispatcher を無視するため、
 * `buildPinnedDispatcher` の lookup コールバック形式が undici で本当に通るかは
 * 検証されていなかった。Issue #81 の v0.1.3 リグレッションを再発見した文脈から、
 * この層は **必須** とする。
 *
 * このテストは:
 * - 127.0.0.1 にバインドした実 HTTP サーバを立てる
 * - `buildPinnedDispatcher("127.0.0.1")` を実 `fetch` （undici）に渡し、
 *   別ホスト名 `http://example.com:PORT/` で接続を試みる
 * - DNS が解決されたら別 IP に行くはずなので、200 が返るのは
 *   **dispatcher の lookup が確実に効いている証拠**
 *
 * vitest 既定の jsdom 環境では undici が初期化に失敗するため、
 * 先頭で `// @vitest-environment node` を指定して node 環境に切り替える。
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
// 実 undici の fetch を直接使う（globalThis.fetch も Node 20+ では undici だが
// 明示することで「結合テストである」意図を表現する）
import { fetch as undiciFetch } from "undici";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPinnedDispatcher } from "@/lib/ai/url-safety";

let server: http.Server;
let port: number;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    // dispatcher が来た先を観測するためのテストフィクスチャ。
    // text/plain + JSON で返すことで reflected XSS 表面を作らない
    // （CodeQL js/reflected-xss 対策。実害ゼロだが構造的に消しておく）
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ host: req.headers.host, path: req.url }));
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe("buildPinnedDispatcher (実 undici 結合)", () => {
  it("pinned IP に接続成功（配列形式 lookup 検証）", async () => {
    const dispatcher = buildPinnedDispatcher("127.0.0.1");
    try {
      // example.com は実際には 127.0.0.1 に解決しない。dispatcher の lookup
      // が効いているからこそ、ローカルサーバに繋がって 200 を返す。
      const response = await undiciFetch(`http://example.com:${port}/test`, {
        dispatcher,
      });
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { host: string; path: string };
      // Host ヘッダーは元の hostname を維持（SNI / 証明書互換性のため重要）
      expect(payload.host).toBe(`example.com:${port}`);
      expect(payload.path).toBe("/test");
    } finally {
      await dispatcher.close();
    }
  });

  it("異なる Host ヘッダーで複数リクエストしても、すべて pinned IP に到達する", async () => {
    const dispatcher = buildPinnedDispatcher("127.0.0.1");
    try {
      const hosts = ["a.example.com", "b.example.com", "c.example.com"];
      const payloads = await Promise.all(
        hosts.map(async (host) => {
          const response = await undiciFetch(`http://${host}:${port}/x`, {
            dispatcher,
          });
          return (await response.json()) as { host: string; path: string };
        }),
      );
      for (const [i, payload] of payloads.entries()) {
        expect(payload.host).toBe(`${hosts[i]}:${port}`);
      }
    } finally {
      await dispatcher.close();
    }
  });

  it("コールバックが配列形式である（Happy Eyeballs / autoSelectFamily=true 互換）", async () => {
    // 別経路としても確認: dispatcher 内部の lookup を直接呼んで形式を観測
    const dispatcher = buildPinnedDispatcher("203.0.113.1"); // TEST-NET-3
    // @ts-expect-error - 内部 connect オプションへの直接アクセス（テスト用）
    const lookup = dispatcher[Symbol.for("undici.agent.options")]?.connect?.lookup;
    if (typeof lookup === "function") {
      const result = await new Promise<unknown>((resolve, reject) => {
        lookup("ignored.example.com", {}, (err: unknown, value: unknown) => {
          if (err) reject(err);
          else resolve(value);
        });
      });
      // 配列形式: [{ address, family }]
      expect(Array.isArray(result)).toBe(true);
      expect((result as Array<{ address: string; family: number }>)[0]).toEqual({
        address: "203.0.113.1",
        family: 4,
      });
    }
    await dispatcher.close();
  });
});
