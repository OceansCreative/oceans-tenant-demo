/**
 * `/api/vitals` POST と `/api/vitals/summary` GET の統合的なユニットテスト。
 *
 * - `sanitizePathname` は pure 関数として単独でも検証
 * - POST 経路は Zod 検証境界（OK / NG）、レート制限拒否、store への副作用を確認
 * - GET 経路は store に積んだサンプルを正しく集計して返すかを確認
 *
 * `rate-limit` の内部状態と `vitals/store` の内部状態は test 同士で
 * 干渉しないよう `beforeEach` でリセットする。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitForTesting } from "@/lib/rate-limit";
import { __resetVitalsStoreForTesting } from "@/lib/vitals/store";
import { POST, sanitizePathname, type VitalsPostBody } from "../route";
import { GET as SummaryGET } from "../summary/route";

const buildRequest = (body: unknown, init?: RequestInit): Request => {
  return new Request("http://localhost/api/vitals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "10.0.0.1",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
};

const validBody = (overrides: Partial<VitalsPostBody> = {}): VitalsPostBody => ({
  metric: "LCP",
  value: 1234,
  path: "/search",
  navigationType: "navigate",
  ...overrides,
});

describe("sanitizePathname", () => {
  it("query を含まないパスはそのまま返す", () => {
    expect(sanitizePathname("/search")).toBe("/search");
  });

  it("query 以降を落とす", () => {
    expect(sanitizePathname("/search?q=cafe")).toBe("/search");
  });

  it("hash も落とす", () => {
    expect(sanitizePathname("/search#top")).toBe("/search");
  });

  it("query と hash 両方含む場合、最初に現れた区切りで切る", () => {
    expect(sanitizePathname("/search?q=cafe#top")).toBe("/search");
    expect(sanitizePathname("/search#top?q=cafe")).toBe("/search");
  });
});

describe("POST /api/vitals", () => {
  beforeEach(() => {
    __resetRateLimitForTesting();
    __resetVitalsStoreForTesting();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("有効な payload を受理して 202 を返す", async () => {
    const res = await POST(buildRequest(validBody()));
    expect(res.status).toBe(202);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("未知の metric は 400 を返す", async () => {
    const res = await POST(buildRequest({ ...validBody(), metric: "UNKNOWN" }));
    expect(res.status).toBe(400);
  });

  it("path が query を含む場合は 400 を返す", async () => {
    const res = await POST(buildRequest({ ...validBody(), path: "/search?q=cafe" }));
    expect(res.status).toBe(400);
  });

  it("path が / で始まらない場合は 400", async () => {
    const res = await POST(buildRequest({ ...validBody(), path: "search" }));
    expect(res.status).toBe(400);
  });

  it("value が負値の場合は 400", async () => {
    const res = await POST(buildRequest({ ...validBody(), value: -1 }));
    expect(res.status).toBe(400);
  });

  it("value が NaN の場合は 400", async () => {
    // JSON 上は NaN を直接表現できないので、文字列として送って parser を試す。
    const res = await POST(
      buildRequest('{"metric":"LCP","value":"abc","path":"/","navigationType":"navigate"}'),
    );
    expect(res.status).toBe(400);
  });

  it("CLS は無次元値（0–100 程度）を受理する", async () => {
    const res = await POST(buildRequest(validBody({ metric: "CLS", value: 0.15 })));
    expect(res.status).toBe(202);
  });

  it("LCP の現実離れした上限超え（1 時間以上）は 400", async () => {
    const res = await POST(buildRequest(validBody({ metric: "LCP", value: 5_000_000 })));
    expect(res.status).toBe(400);
  });

  it("レート制限超過時は 429 を返す", async () => {
    // capacity=60 を環境変数なしの既定値で消費し切る
    const requests = Array.from({ length: 61 }, () => buildRequest(validBody()));
    const responses: Response[] = [];
    for (const req of requests) {
      // 並列だと bucket への作用順が非決定なので逐次評価
      responses.push(await POST(req));
    }
    expect(responses[60]?.status).toBe(429);
    const retryAfter = responses[60]?.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
  });

  it("body が JSON でない場合も 400 を返す", async () => {
    const res = await POST(buildRequest("not a json"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/vitals/summary", () => {
  beforeEach(() => {
    __resetRateLimitForTesting();
    __resetVitalsStoreForTesting();
  });

  it("POST 後に summary を返す", async () => {
    await POST(buildRequest(validBody({ metric: "LCP", path: "/", value: 1000 })));
    await POST(buildRequest(validBody({ metric: "LCP", path: "/", value: 2000 })));
    await POST(buildRequest(validBody({ metric: "INP", path: "/", value: 100 })));

    const res = await SummaryGET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      summaries: ReadonlyArray<{
        metric: string;
        path: string;
        sampleCount: number;
        median: number;
        p75: number;
      }>;
    };
    expect(json.summaries).toHaveLength(2);
    const lcp = json.summaries.find((s) => s.metric === "LCP");
    expect(lcp?.sampleCount).toBe(2);
    expect(lcp?.median).toBe(1500);
  });

  it("空 store のときは空配列を返す", async () => {
    const res = await SummaryGET();
    const json = (await res.json()) as { summaries: ReadonlyArray<unknown> };
    expect(json.summaries).toEqual([]);
  });
});
