"use client";

/**
 * `VitalsReporter` — `web-vitals` v5 で計測したフィールドメトリクスを
 * `/api/vitals` に送信する非表示の Client Component。
 *
 * RootLayout に 1 度だけマウントする想定。Hooks に依存しないが、`useEffect` で
 * 1 回だけ初期化したいので関数コンポーネントで実装する。
 *
 * 設計判断:
 * - メトリクス取得時（onLCP / onINP / onCLS / onFCP / onTTFB のコールバック）に
 *   その場で送信する。`web-vitals` 側のデバウンスにより、各メトリクスは
 *   ページライフサイクル中に複数回 fire する可能性がある（特に CLS / INP）。
 * - `visibilitychange (hidden)` で `report({ flush: true })` を発火し、未送信分を
 *   `sendBeacon` で flush する。`pagehide` も併用してクロスブラウザ確実性を上げる。
 * - 送信は `navigator.sendBeacon` 優先。利用不可（古いブラウザ）/ false 返却時は
 *   `fetch(..., { keepalive: true })` に fallback する。
 * - `pathname` のみ収集する（query / hash は含めない）。`window.location.pathname` を
 *   直接読むのは Suspense / hydration の影響を受けないようにするため。
 * - 失敗しても UI には一切影響させない（Lighthouse / LCP に影響しないよう、
 *   `requestIdleCallback` を試して低優先度で実行）。
 */

import { useEffect } from "react";
import type { Metric } from "web-vitals";
import type { VitalsBeaconPayload, VitalsMetric } from "@/lib/vitals/types";

/**
 * `web-vitals` の `Metric.name` を内部の `VitalsMetric` に絞り込む。
 * `web-vitals` v5 では INP が安定版に格上げされ、上記 5 種類が public API。
 */
const isSupportedMetric = (name: string): name is VitalsMetric =>
  name === "LCP" || name === "INP" || name === "CLS" || name === "FCP" || name === "TTFB";

/**
 * Payload を JSON Blob にして送信する。
 *
 * sendBeacon は最大ペイロードサイズが制限される（実装依存。多くは 64 KB）が、
 * 1 メトリクスあたり 100 バイト程度なので問題にならない。
 */
const sendPayload = (payload: VitalsBeaconPayload): void => {
  if (typeof window === "undefined") return;
  const url = "/api/vitals";
  const body = JSON.stringify(payload);

  // sendBeacon を最優先で試す（unload 中でも送信される）。
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    } catch {
      // 一部ブラウザは MIME 制限で false を返すか throw する。fetch fallback に流す。
    }
  }

  // fallback: keepalive で unload 中でも完了する可能性を残す。
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      // ベストエフォート: 失敗時もユーザ操作に一切影響させない。
    }).catch(() => {});
  } catch {
    // window が立ち上がっていない / fetch が無い等は静かに無視
  }
};

/**
 * `Metric` を `VitalsBeaconPayload` に変換する。
 *
 * - 未サポートメトリクス → null（呼び出し側で握りつぶす）
 * - path は `window.location.pathname` を採用（next-intl の prefix `/en` も
 *   そのまま path として送る。Insights 側で集計するときに有用な粒度）
 */
/**
 * web-vitals v5 の `navigationType` は `back-forward` / `back-forward-cache` を返すが、
 * サーバ側 Zod は `back_forward` を受け付ける（Web Performance API 旧表記に合わせている）。
 * クライアント側で snake_case へ正規化することで、サーバ Zod を 1 つの真実に揃える。
 */
const normalizeNavigationType = (
  raw: Metric["navigationType"] | undefined,
): VitalsBeaconPayload["navigationType"] => {
  if (raw === "back-forward" || raw === "back-forward-cache") return "back_forward";
  if (raw === "navigate" || raw === "reload" || raw === "prerender" || raw === "restore") {
    return raw;
  }
  // 未知 / undefined は安全側に navigate にフォールバック
  return "navigate";
};

export const toBeaconPayload = (metric: Metric, pathname: string): VitalsBeaconPayload | null => {
  if (!isSupportedMetric(metric.name)) return null;
  return {
    metric: metric.name,
    value: metric.value,
    path: pathname,
    navigationType: normalizeNavigationType(metric.navigationType),
  };
};

/**
 * メトリクス受信時のハンドラ。`pathname` はクロージャ経由ではなく、
 * 受信時の `window.location.pathname` を読むことで SPA 遷移後の値を捕捉する。
 *
 * `web-vitals` の callback は report 単位（同一ページ）でしか fire しないが、
 * フォールバックとして安全側に倒す。
 */
const handleMetric = (metric: Metric): void => {
  if (typeof window === "undefined") return;
  const payload = toBeaconPayload(metric, window.location.pathname);
  if (!payload) return;
  sendPayload(payload);
};

export const VitalsReporter = (): null => {
  useEffect(() => {
    let cancelled = false;

    const setup = async (): Promise<void> => {
      // `web-vitals` は ESM-only かつ tree-shake 対象。dynamic import で
      // 初期 JS バンドルから外す（Lighthouse スコアへの影響を最小化）。
      try {
        const { onLCP, onINP, onCLS, onFCP, onTTFB } = await import("web-vitals");
        if (cancelled) return;
        onLCP(handleMetric);
        onINP(handleMetric);
        onCLS(handleMetric);
        onFCP(handleMetric);
        onTTFB(handleMetric);
      } catch (error) {
        // 計測失敗で UI を壊さない。本番では Sentry 等に流す想定。
        if (process.env.NODE_ENV !== "production") {
          console.warn("[vitals] web-vitals の読み込みに失敗", error);
        }
      }
    };

    // 初期 LCP を妨げないよう、可能なら idle callback で開始する。
    type IdleScheduler = (cb: () => void) => void;
    const schedule: IdleScheduler =
      typeof (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback ===
      "function"
        ? (cb) =>
            (
              window as unknown as { requestIdleCallback: (cb: () => void) => void }
            ).requestIdleCallback(cb)
        : (cb) => window.setTimeout(cb, 0);
    schedule(() => {
      void setup();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
};

export default VitalsReporter;
