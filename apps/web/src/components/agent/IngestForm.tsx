"use client";

import type { PropertyWithTsubo } from "@oceans-tenant/shared";
import { useState } from "react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { cn } from "@/lib/cn";

type IngestResponseOk = {
  status: "ok";
  draft: PropertyWithTsubo;
  confidence: number;
};

type IngestResponseError = {
  status: "error";
  error: string;
};

type IngestResponse = IngestResponseOk | IngestResponseError;

export const IngestForm = (): React.JSX.Element => {
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<IngestResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url) return;
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as IngestResponse;
      setResult(data);
    } catch (error) {
      setResult({
        status: "error",
        error: error instanceof Error ? error.message : "不明なエラー",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-neutral-800">物件掲載 URL</span>
          <input
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/listings/..."
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !url}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "AI で抽出中…" : "AI で抽出"}
        </button>
        <p className="text-xs text-neutral-500">
          URL の本文を Claude API が読み取り、住所・賃料・面積などを自動で埋めます。実 API
          キーが未設定の場合は失敗します。
        </p>
      </form>

      <section aria-live="polite" aria-busy={pending}>
        {result?.status === "ok" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-neutral-500">AI 抽出信頼度</p>
                <div className="mt-1 h-2 w-full rounded-full bg-neutral-200">
                  <div
                    className={cn(
                      "h-2 rounded-full",
                      result.confidence >= 0.8
                        ? "bg-emerald-500"
                        : result.confidence >= 0.5
                          ? "bg-amber-500"
                          : "bg-red-500",
                    )}
                    style={{ width: `${Math.round(result.confidence * 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold">{(result.confidence * 100).toFixed(0)}%</span>
            </div>
            <PropertyCard property={result.draft} />
            <p className="text-xs text-neutral-500">
              ※ プレビューのみ。Sanity への保存は次の Issue で実装します。
            </p>
          </div>
        )}
        {result?.status === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">抽出に失敗しました</p>
            <p className="mt-1 text-xs">{result.error}</p>
          </div>
        )}
      </section>
    </div>
  );
};
