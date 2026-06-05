import type { Property } from "@oceans-tenant/shared";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyEditForm } from "@/components/admin/PropertyEditForm";
import { renderWithI18n } from "../../test-utils";

/**
 * PropertyEditForm のユニットテスト。
 *
 * - 新規モード: 初期値が空で render され、必須フィールドがある
 * - 編集モード: `initial` の値が反映される（slug が disabled）
 * - 送信 → `fetch('/api/admin/property', { method: 'POST' })` が呼ばれる
 * - 削除 → `window.confirm` 経由 → `fetch('/api/admin/property', { method: 'DELETE' })` が呼ばれる
 *
 * `next/navigation` は jsdom 未提供のため最小限の mock を当てる。
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const buildSample = (overrides: Partial<Property> = {}): Property => ({
  title: "サンプル物件",
  slug: "sample-prop",
  address: {
    prefecture: "東京都",
    city: "新宿区",
    geopoint: { lat: 35.69, lng: 139.7 },
  },
  nearestStations: [],
  rent: 250000,
  area: 22,
  suitableBusinessRefs: [],
  images: [],
  features: [],
  availability: "public",
  listedByRef: "company-001",
  aiMeta: { aiExtracted: false },
  publishedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ status: "ok", mode: "mock" }),
  })) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("PropertyEditForm", () => {
  it("新規モードでは title / slug が空で render される", () => {
    renderWithI18n(<PropertyEditForm />);
    const title = screen.getByLabelText("物件名");
    const slug = screen.getByLabelText("slug");
    expect((title as HTMLInputElement).value).toBe("");
    expect((slug as HTMLInputElement).value).toBe("");
    expect(slug).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
  });

  it("編集モードでは initial の値が反映され、slug は disabled", () => {
    renderWithI18n(<PropertyEditForm initial={buildSample()} />);
    expect((screen.getByLabelText("物件名") as HTMLInputElement).value).toBe("サンプル物件");
    expect((screen.getByLabelText("slug") as HTMLInputElement).value).toBe("sample-prop");
    expect(screen.getByLabelText("slug")).toBeDisabled();
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  });

  it("submit すると /api/admin/property に POST される", async () => {
    renderWithI18n(<PropertyEditForm />);
    fireEvent.change(screen.getByLabelText("物件名"), { target: { value: "新規物件" } });
    fireEvent.change(screen.getByLabelText("slug"), { target: { value: "new-prop" } });
    fireEvent.change(screen.getByLabelText("市区町村"), { target: { value: "渋谷区" } });

    const form = screen.getByTestId("property-edit-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/admin/property",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
    expect(body.title).toBe("新規物件");
    expect(body.slug).toBe("new-prop");
  });

  it("削除ボタンを押すと DELETE が呼ばれる（confirm が true のとき）", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithI18n(<PropertyEditForm initial={buildSample()} />);
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/property?slug=sample-prop"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    confirmSpy.mockRestore();
  });

  it("confirm が false のときは DELETE が呼ばれない", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithI18n(<PropertyEditForm initial={buildSample()} />);
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({ status: "error", error: "Validation failed" }),
    })) as unknown as typeof fetch;
    renderWithI18n(<PropertyEditForm />);
    fireEvent.change(screen.getByLabelText("物件名"), { target: { value: "新規物件" } });
    fireEvent.change(screen.getByLabelText("slug"), { target: { value: "new-prop" } });
    fireEvent.change(screen.getByLabelText("市区町村"), { target: { value: "渋谷区" } });
    fireEvent.submit(screen.getByTestId("property-edit-form"));
    await waitFor(() => {
      expect(screen.getByText(/Validation failed/)).toBeInTheDocument();
    });
  });
});
