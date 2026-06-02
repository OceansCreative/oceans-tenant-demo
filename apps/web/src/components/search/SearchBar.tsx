"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";

type SearchBarProps = {
  readonly className?: string;
};

/**
 * 検索画面ヘッダーのフリーテキスト検索バー。
 * `q` クエリパラメータを更新する。
 *
 * Phase 3 で /chat や /api/chat-search 連携を後付けする想定。
 */
export const SearchBar = ({ className }: SearchBarProps): React.JSX.Element => {
  const t = useTranslations("search.searchBar");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams?.get("q") ?? "");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    const trimmed = value.trim();
    if (trimmed) {
      next.set("q", trimmed);
    } else {
      next.delete("q");
    }
    // 検索語変更時はページを 1 に戻す（パース側の page=1 デフォルトに任せるため明示削除）。
    next.delete("page");
    const query = next.toString();
    startTransition(() => {
      router.replace(`/search${query ? `?${query}` : ""}` as never);
    });
  };

  return (
    <search className={cn("block", className)}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4 text-neutral-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>{t("iconTitle")}</title>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          aria-label={t("ariaLabel")}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("placeholder")}
          maxLength={200}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {t("submit")}
        </button>
      </form>
    </search>
  );
};
