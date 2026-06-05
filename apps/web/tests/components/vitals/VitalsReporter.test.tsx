/**
 * VitalsReporter のユニットテスト。
 *
 * jsdom 環境で `web-vitals` 全体を mock し、各 `on*` コールバックに与えた
 * Metric オブジェクトが `navigator.sendBeacon` 経由で `/api/vitals` に
 * 送られることを確認する。
 *
 * pure helper `toBeaconPayload` も同じファイル内で網羅的にテストする。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toBeaconPayload, VitalsReporter } from "@/components/vitals/VitalsReporter";
import { renderWithI18n } from "../../test-utils";

const lcpHandlers: Array<(metric: unknown) => void> = [];
const inpHandlers: Array<(metric: unknown) => void> = [];
const clsHandlers: Array<(metric: unknown) => void> = [];
const fcpHandlers: Array<(metric: unknown) => void> = [];
const ttfbHandlers: Array<(metric: unknown) => void> = [];

vi.mock("web-vitals", () => ({
  onLCP: (cb: (metric: unknown) => void) => lcpHandlers.push(cb),
  onINP: (cb: (metric: unknown) => void) => inpHandlers.push(cb),
  onCLS: (cb: (metric: unknown) => void) => clsHandlers.push(cb),
  onFCP: (cb: (metric: unknown) => void) => fcpHandlers.push(cb),
  onTTFB: (cb: (metric: unknown) => void) => ttfbHandlers.push(cb),
}));

const flushMicrotasks = async (): Promise<void> => {
  // dynamic import + idle schedule → 2 マイクロタスクほど経由するので余裕を持って待つ
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

describe("toBeaconPayload", () => {
  it("既知 metric は VitalsBeaconPayload に変換される", () => {
    const payload = toBeaconPayload(
      {
        name: "LCP",
        value: 1234,
        navigationType: "navigate",
      } as unknown as Parameters<typeof toBeaconPayload>[0],
      "/search",
    );
    expect(payload).toEqual({
      metric: "LCP",
      value: 1234,
      path: "/search",
      navigationType: "navigate",
    });
  });

  it("navigationType 未指定なら navigate にフォールバック", () => {
    const payload = toBeaconPayload(
      {
        name: "INP",
        value: 50,
      } as unknown as Parameters<typeof toBeaconPayload>[0],
      "/",
    );
    expect(payload?.navigationType).toBe("navigate");
  });

  it("未サポート metric は null", () => {
    const payload = toBeaconPayload(
      {
        name: "WHATEVER",
        value: 1,
        navigationType: "navigate",
      } as unknown as Parameters<typeof toBeaconPayload>[0],
      "/",
    );
    expect(payload).toBeNull();
  });

  it("web-vitals v5 の back-forward は back_forward に正規化される", () => {
    const payload = toBeaconPayload(
      {
        name: "LCP",
        value: 1500,
        navigationType: "back-forward",
      } as unknown as Parameters<typeof toBeaconPayload>[0],
      "/",
    );
    expect(payload?.navigationType).toBe("back_forward");
  });

  it("web-vitals v5 の back-forward-cache も back_forward に正規化される", () => {
    const payload = toBeaconPayload(
      {
        name: "LCP",
        value: 1500,
        navigationType: "back-forward-cache",
      } as unknown as Parameters<typeof toBeaconPayload>[0],
      "/",
    );
    expect(payload?.navigationType).toBe("back_forward");
  });
});

describe("VitalsReporter", () => {
  beforeEach(() => {
    lcpHandlers.length = 0;
    inpHandlers.length = 0;
    clsHandlers.length = 0;
    fcpHandlers.length = 0;
    ttfbHandlers.length = 0;
    // `requestIdleCallback` を未定義に倒し setTimeout(0) 経路に流す（jsdom デフォルト）
    delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
    // `pathname` を固定
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost/search"),
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("マウント時に web-vitals の各メトリクスへハンドラを登録する", async () => {
    renderWithI18n(<VitalsReporter />);
    // setTimeout(0) 経由の setup を進める
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    await flushMicrotasks();
    expect(lcpHandlers.length).toBeGreaterThanOrEqual(1);
    expect(inpHandlers.length).toBeGreaterThanOrEqual(1);
    expect(clsHandlers.length).toBeGreaterThanOrEqual(1);
    expect(fcpHandlers.length).toBeGreaterThanOrEqual(1);
    expect(ttfbHandlers.length).toBeGreaterThanOrEqual(1);
  });

  it("メトリクス受信時に navigator.sendBeacon を呼ぶ", async () => {
    const sendBeaconSpy = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeaconSpy,
      configurable: true,
      writable: true,
    });

    renderWithI18n(<VitalsReporter />);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    await flushMicrotasks();

    const handler = lcpHandlers[0];
    expect(handler).toBeTypeOf("function");
    handler?.({ name: "LCP", value: 2222, navigationType: "navigate" });
    expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeaconSpy.mock.calls[0] ?? [];
    expect(url).toBe("/api/vitals");
    expect(blob).toBeInstanceOf(Blob);
  });

  it("sendBeacon が false を返したら fetch fallback が呼ばれる", async () => {
    const sendBeaconSpy = vi.fn(() => false);
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeaconSpy,
      configurable: true,
      writable: true,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));

    renderWithI18n(<VitalsReporter />);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    await flushMicrotasks();

    const handler = lcpHandlers[0];
    handler?.({ name: "LCP", value: 3333, navigationType: "reload" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("/api/vitals");
    expect((init as RequestInit)?.keepalive).toBe(true);
    expect((init as RequestInit)?.method).toBe("POST");
  });

  it("未サポートメトリクスはネットワーク呼び出しを起こさない", async () => {
    const sendBeaconSpy = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeaconSpy,
      configurable: true,
      writable: true,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderWithI18n(<VitalsReporter />);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    await flushMicrotasks();

    const handler = lcpHandlers[0];
    handler?.({ name: "BOGUS", value: 0, navigationType: "navigate" });

    expect(sendBeaconSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
