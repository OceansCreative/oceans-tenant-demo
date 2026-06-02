"use client";

import type { PropertyWithTsubo } from "@oceans-tenant/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { cn } from "@/lib/cn";
import { EMPTY_CRITERIA, type SearchCriteria } from "@/lib/search-criteria";
import { generateUuidV4 } from "@/lib/uuid";

type ChatMessage = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
};

const isUuidV4 = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const ChatPanel = (): React.JSX.Element => {
  const t = useTranslations("chat");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY_CRITERIA);
  const [results, setResults] = useState<ReadonlyArray<PropertyWithTsubo>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fromUrl = searchParams?.get("sessionId");
    if (fromUrl && isUuidV4(fromUrl)) {
      setSessionId(fromUrl);
      return;
    }
    const fresh = generateUuidV4();
    setSessionId(fresh);
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("sessionId", fresh);
    router.replace(`/chat?${next.toString()}` as never);
  }, [searchParams, router]);

  // 新規メッセージ追加 / 結果到着 / pending 切替 のいずれでも末尾に追従
  // biome-ignore lint/correctness/useExhaustiveDependencies: pending と messages.length の遷移時に追従させたい
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, pending, results.length]);

  const send = useCallback(async () => {
    if (!input.trim() || !sessionId || pending) return;
    const userMessage: ChatMessage = {
      id: generateUuidV4(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setPending(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/chat-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: [...messages, userMessage].map((message) => ({
            role: message.role,
            content: message.content,
          })),
          currentCriteria: criteria,
        }),
      });
      if (!response.ok || !response.body) {
        const errBody = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errBody.error ?? `HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const block of events) {
          const line = block.split("\n").find((entry) => entry.startsWith("data: "));
          if (!line) continue;
          try {
            const event = JSON.parse(line.slice(6)) as
              | { type: "criteria"; criteria: SearchCriteria }
              | { type: "message"; content: string }
              | { type: "results"; properties: ReadonlyArray<PropertyWithTsubo> }
              | { type: "done" }
              | { type: "error"; error: string };
            if (event.type === "criteria") {
              setCriteria(event.criteria);
            } else if (event.type === "message") {
              setMessages((prev) => [
                ...prev,
                { id: generateUuidV4(), role: "assistant", content: event.content },
              ]);
            } else if (event.type === "results") {
              setResults(event.properties);
            } else if (event.type === "error") {
              setErrorMessage(event.error);
            }
          } catch {
            // ignore malformed event
          }
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : tErrors("communication"));
    } finally {
      setPending(false);
    }
  }, [input, sessionId, pending, messages, criteria, tErrors]);

  const criteriaJson = useMemo(() => JSON.stringify(criteria, null, 2), [criteria]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <section
        aria-label={t("historyAriaLabel")}
        className="flex h-[calc(100vh-12rem)] flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm"
      >
        <header className="border-b border-neutral-200 p-4">
          <p className="text-xs uppercase tracking-wider text-neutral-500">{t("sessionIdLabel")}</p>
          <p className="font-mono text-xs text-neutral-700">{sessionId || t("sessionIdIssuing")}</p>
        </header>
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-center text-xs text-neutral-500">{t("placeholderMessage")}</p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                message.role === "user"
                  ? "ml-auto bg-brand-600 text-white"
                  : "bg-neutral-100 text-neutral-900",
              )}
            >
              {message.content}
            </div>
          ))}
          {pending && (
            <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-4 py-2 text-sm text-neutral-600">
              {t("thinking")}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMessage}
            </div>
          )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="flex gap-2 border-t border-neutral-200 p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={pending}
            placeholder={t("inputPlaceholder")}
            className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
            aria-label={t("inputAriaLabel")}
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {t("send")}
          </button>
        </form>
      </section>

      <section aria-label={t("resultsAriaLabel")} className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">
            {t("extractedCriteriaHeading")}
          </h2>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-700">
            {criteriaJson}
          </pre>
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            {t("resultsHeading", { count: results.length })}
          </h2>
          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-xs text-neutral-500">
              {t("noResults")}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map((property) => (
                <li key={property.slug}>
                  <PropertyCard property={property} className="h-full" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
