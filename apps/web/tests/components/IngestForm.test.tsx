import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IngestForm } from "@/components/agent/IngestForm";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

const [draft] = MOCK_PROPERTIES;
if (!draft) throw new Error("MOCK_PROPERTIES is empty");

const buildJsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IngestForm", () => {
  it("URL 入力欄とラベルが描画される", () => {
    render(<IngestForm />);
    expect(screen.getByText("物件掲載 URL")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: /AI で抽出/ });
    expect(submit).toBeDisabled();
  });

  it("URL を入力するとボタンが活性化する", async () => {
    const user = userEvent.setup();
    render(<IngestForm />);
    const input = screen.getByRole("textbox");
    await user.type(input, "https://example.com/listings/1");
    expect(screen.getByRole("button", { name: /AI で抽出/ })).toBeEnabled();
  });

  it("送信成功時に PropertyCard と信頼度バーを表示する", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(buildJsonResponse({ status: "ok", draft, confidence: 0.92 }));
    const user = userEvent.setup();
    render(<IngestForm />);
    await user.type(screen.getByRole("textbox"), "https://example.com/listings/abc");
    await user.click(screen.getByRole("button", { name: /AI で抽出/ }));
    await waitFor(() => {
      expect(screen.getByText("92%")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ingest-url",
      expect.objectContaining({ method: "POST" }),
    );
    // PropertyCard 内のタイトルが描画される
    expect(screen.getByText(draft.title)).toBeInTheDocument();
  });

  it("信頼度に応じて色帯が変わる（高: emerald）", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildJsonResponse({ status: "ok", draft, confidence: 0.9 }),
    );
    const user = userEvent.setup();
    const { container } = render(<IngestForm />);
    await user.type(screen.getByRole("textbox"), "https://example.com/listings/abc");
    await user.click(screen.getByRole("button", { name: /AI で抽出/ }));
    await waitFor(() => screen.getByText("90%"));
    expect(container.innerHTML).toMatch(/bg-emerald-500/);
  });

  it("信頼度が中位（0.6）のときは amber 帯になる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildJsonResponse({ status: "ok", draft, confidence: 0.6 }),
    );
    const user = userEvent.setup();
    const { container } = render(<IngestForm />);
    await user.type(screen.getByRole("textbox"), "https://example.com/listings/abc");
    await user.click(screen.getByRole("button", { name: /AI で抽出/ }));
    await waitFor(() => screen.getByText("60%"));
    expect(container.innerHTML).toMatch(/bg-amber-500/);
  });

  it("信頼度が低い（0.3）ときは red 帯になる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildJsonResponse({ status: "ok", draft, confidence: 0.3 }),
    );
    const user = userEvent.setup();
    const { container } = render(<IngestForm />);
    await user.type(screen.getByRole("textbox"), "https://example.com/listings/abc");
    await user.click(screen.getByRole("button", { name: /AI で抽出/ }));
    await waitFor(() => screen.getByText("30%"));
    expect(container.innerHTML).toMatch(/bg-red-500/);
  });

  it("API から error が返ったときはエラー表示する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildJsonResponse({ status: "error", error: "URL を取得できませんでした" }),
    );
    const user = userEvent.setup();
    render(<IngestForm />);
    await user.type(screen.getByRole("textbox"), "https://example.com/listings/abc");
    await user.click(screen.getByRole("button", { name: /AI で抽出/ }));
    await waitFor(() => {
      expect(screen.getByText("抽出に失敗しました")).toBeInTheDocument();
    });
    expect(screen.getByText("URL を取得できませんでした")).toBeInTheDocument();
  });

  it("fetch 自体が例外を投げたときは Error.message を表示する", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ネットワーク断"));
    const user = userEvent.setup();
    render(<IngestForm />);
    await user.type(screen.getByRole("textbox"), "https://example.com/listings/abc");
    await user.click(screen.getByRole("button", { name: /AI で抽出/ }));
    await waitFor(() => {
      expect(screen.getByText("ネットワーク断")).toBeInTheDocument();
    });
  });

  it("非 Error の rejection は「不明なエラー」と表示する", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue("string-error");
    const user = userEvent.setup();
    render(<IngestForm />);
    await user.type(screen.getByRole("textbox"), "https://example.com/listings/abc");
    await user.click(screen.getByRole("button", { name: /AI で抽出/ }));
    await waitFor(() => {
      expect(screen.getByText("不明なエラー")).toBeInTheDocument();
    });
  });

  it("送信中はボタンラベルが「AI で抽出中…」になる", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<IngestForm />);
    await user.type(screen.getByRole("textbox"), "https://example.com/listings/abc");
    await user.click(screen.getByRole("button", { name: /AI で抽出/ }));
    expect(screen.getByRole("button", { name: "AI で抽出中…" })).toBeInTheDocument();
    resolveFetch(buildJsonResponse({ status: "ok", draft, confidence: 0.5 }));
    await waitFor(() => screen.getByText("50%"));
  });
});
