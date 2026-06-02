import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/studio` ルートの分岐挙動を検証する。
 *
 * - 環境変数 `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` が未設定の場合は
 *   設定手順を案内するフォールバック UI を表示する。
 * - 両方設定されている場合は `StudioClient`（NextStudio ラッパー）を呼び出す。
 *
 * `StudioClient` は `next-sanity/studio` の `NextStudio` を内包する Client Component で、
 * jsdom で完全に立ち上げるのは負荷が大きいためモックする。
 */
vi.mock("@/app/studio/[[...tool]]/StudioClient", () => ({
  StudioClient: () => <div data-testid="studio-client">NextStudio mounted</div>,
}));

describe("/studio ページの分岐", () => {
  const originalProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const originalDataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalProjectId === undefined) {
      delete process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    } else {
      process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = originalProjectId;
    }
    if (originalDataset === undefined) {
      delete process.env.NEXT_PUBLIC_SANITY_DATASET;
    } else {
      process.env.NEXT_PUBLIC_SANITY_DATASET = originalDataset;
    }
  });

  it("環境変数が未設定の場合はフォールバック UI を表示する", async () => {
    delete process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_SANITY_DATASET;

    const mod = await import("@/app/studio/[[...tool]]/page");
    const Page = mod.default;
    const ui = await Page();
    render(ui);

    expect(screen.getByText("Sanity Studio は未設定です")).toBeInTheDocument();
    expect(screen.getByText(/ホームに戻る/)).toBeInTheDocument();
    expect(screen.queryByTestId("studio-client")).toBeNull();
  });

  it("projectId だけ設定されていてもフォールバックする", async () => {
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = "abc123";
    delete process.env.NEXT_PUBLIC_SANITY_DATASET;

    const mod = await import("@/app/studio/[[...tool]]/page");
    const Page = mod.default;
    const ui = await Page();
    render(ui);

    expect(screen.getByText("Sanity Studio は未設定です")).toBeInTheDocument();
  });

  it("両方の環境変数が揃うと NextStudio をレンダリングする", async () => {
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = "abc123";
    process.env.NEXT_PUBLIC_SANITY_DATASET = "production";

    const mod = await import("@/app/studio/[[...tool]]/page");
    const Page = mod.default;
    const ui = await Page();
    render(ui);

    expect(screen.getByTestId("studio-client")).toBeInTheDocument();
    expect(screen.queryByText("Sanity Studio は未設定です")).toBeNull();
  });

  it("page から viewport / metadata が export されている", async () => {
    const mod = await import("@/app/studio/[[...tool]]/page");
    expect(mod.metadata.title).toBe("Sanity Studio");
    expect(mod.metadata.robots).toEqual({ index: false, follow: false });
    expect(mod.viewport.width).toBe("device-width");
    expect(mod.viewport.initialScale).toBe(1);
  });
});
