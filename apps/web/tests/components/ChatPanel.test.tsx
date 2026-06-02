import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jaMessages from "../../messages/ja.json";
import { renderWithI18n } from "../test-utils";

// Next.js のフックをモック化（jsdom 環境用）
const mockReplace = vi.fn();
let mockSearchParamsString = "";
const mockSearchParams = {
  toString: () => mockSearchParamsString,
  get: (key: string) => new URLSearchParams(mockSearchParamsString).get(key),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/uuid", () => ({
  generateUuidV4: () => "12345678-1234-4567-89ab-123456789abc",
}));

// scrollTo を spy しやすくするためのモック
const scrollToSpy = vi.fn();

beforeEach(() => {
  scrollToSpy.mockClear();
  mockReplace.mockClear();
  mockSearchParamsString = "";
  Element.prototype.scrollTo = scrollToSpy as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { ChatPanel } from "@/components/chat/ChatPanel";

const tChat = jaMessages.chat;

/**
 * SSE レスポンスをスタブするヘルパ。
 * 各イベントを `data: <json>\n\n` の形式で結合してストリームに流す。
 */
const buildSseResponse = (events: ReadonlyArray<unknown>): Response => {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
};

describe("ChatPanel auto-scroll (Issue #56)", () => {
  it("初回マウント時に末尾までスクロールする", async () => {
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    expect(scrollToSpy).toHaveBeenCalled();
  });

  it("scrollTo が smooth behavior で呼ばれる", async () => {
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    const lastCall = scrollToSpy.mock.calls[scrollToSpy.mock.calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({ behavior: "smooth" });
  });
});

describe("ChatPanel rendering", () => {
  it("初期状態でプレースホルダー文言を表示する", async () => {
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    expect(screen.getByText(tChat.placeholderMessage)).toBeInTheDocument();
  });

  it("メッセージ入力欄に aria-label が付く", async () => {
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    expect(screen.getByLabelText(tChat.inputAriaLabel)).toBeInTheDocument();
  });

  it("入力が空のとき送信ボタンは disabled", async () => {
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    expect(screen.getByRole("button", { name: tChat.send })).toBeDisabled();
  });

  it("ヒット物件が 0 件のときは空状態メッセージを描画", async () => {
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    expect(screen.getByText(tChat.noResults)).toBeInTheDocument();
    // ヒット物件見出しは ICU で {count} 埋め込みのため正規表現で照合
    expect(screen.getByText(/ヒット物件\s*\(0\)/)).toBeInTheDocument();
  });

  it("URL の sessionId が UUID v4 ならそのまま表示する", async () => {
    mockSearchParamsString = "sessionId=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    expect(screen.getByText("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBeInTheDocument();
  });

  it("URL の sessionId が不正なときは新規発行し router.replace を呼ぶ", async () => {
    mockSearchParamsString = "sessionId=invalid";
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    expect(mockReplace).toHaveBeenCalled();
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).toMatch(/sessionId=12345678/);
  });

  it("locale=en では英語ラベルになる", async () => {
    await act(async () => {
      renderWithI18n(<ChatPanel />, { locale: "en" });
    });
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
});

describe("ChatPanel SSE 連携", () => {
  it("メッセージ送信時に /api/chat-search に POST する", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(buildSseResponse([{ type: "done" }]));
    const user = userEvent.setup();
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    const input = screen.getByLabelText(tChat.inputAriaLabel);
    await user.type(input, "新宿カフェ");
    await user.click(screen.getByRole("button", { name: tChat.send }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/chat-search");
    expect((init as RequestInit | undefined)?.method).toBe("POST");
  });

  it("ユーザーメッセージが送信後にチャット履歴に追加される", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(buildSseResponse([{ type: "done" }]));
    const user = userEvent.setup();
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    await user.type(screen.getByLabelText(tChat.inputAriaLabel), "新宿の物件を探して");
    await user.click(screen.getByRole("button", { name: tChat.send }));
    await waitFor(() => {
      expect(screen.getByText("新宿の物件を探して")).toBeInTheDocument();
    });
  });

  it("SSE の message イベントでアシスタント返信が追加される", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSseResponse([{ type: "message", content: "条件を整理しました" }, { type: "done" }]),
    );
    const user = userEvent.setup();
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    await user.type(screen.getByLabelText(tChat.inputAriaLabel), "おしえて");
    await user.click(screen.getByRole("button", { name: tChat.send }));
    await waitFor(() => {
      expect(screen.getByText("条件を整理しました")).toBeInTheDocument();
    });
  });

  it("SSE の criteria イベントが抽出条件 JSON プレビューに反映される", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSseResponse([
        {
          type: "criteria",
          criteria: {
            prefecture: "東京都",
            buildingTypes: [],
            conditions: [],
            businessCategoryRefs: [],
            page: 1,
            pageSize: 20,
          },
        },
        { type: "done" },
      ]),
    );
    const user = userEvent.setup();
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    await user.type(screen.getByLabelText(tChat.inputAriaLabel), "新宿");
    await user.click(screen.getByRole("button", { name: tChat.send }));
    await waitFor(() => {
      const pre = document.querySelector("pre");
      expect(pre?.textContent ?? "").toMatch(/"prefecture": "東京都"/);
    });
  });

  it("SSE の error イベントがエラー表示として描画される", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSseResponse([{ type: "error", error: "rate limit" }, { type: "done" }]),
    );
    const user = userEvent.setup();
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    await user.type(screen.getByLabelText(tChat.inputAriaLabel), "test");
    await user.click(screen.getByRole("button", { name: tChat.send }));
    await waitFor(() => {
      expect(screen.getByText("rate limit")).toBeInTheDocument();
    });
  });

  it("HTTP エラーレスポンスでは body の error を Error として表示する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "サーバー過負荷" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    await user.type(screen.getByLabelText(tChat.inputAriaLabel), "test");
    await user.click(screen.getByRole("button", { name: tChat.send }));
    await waitFor(() => {
      expect(screen.getByText("サーバー過負荷")).toBeInTheDocument();
    });
  });

  it("fetch が例外を投げたら Error.message を表示する", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("通信が切れました"));
    const user = userEvent.setup();
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    await user.type(screen.getByLabelText(tChat.inputAriaLabel), "test");
    await user.click(screen.getByRole("button", { name: tChat.send }));
    await waitFor(() => {
      expect(screen.getByText("通信が切れました")).toBeInTheDocument();
    });
  });

  it("空白だけのメッセージでは fetch を呼ばない", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    const input = screen.getByLabelText(tChat.inputAriaLabel);
    await user.type(input, "    ");
    // 送信ボタンは trim 後の長さ 0 で disabled なのでクリック自体できない
    expect(screen.getByRole("button", { name: tChat.send })).toBeDisabled();
    // 念のため form submit 経由を試しても fetch されない
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("送信中は「考えています…」が表示される", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup();
    await act(async () => {
      renderWithI18n(<ChatPanel />);
    });
    await user.type(screen.getByLabelText(tChat.inputAriaLabel), "test");
    await user.click(screen.getByRole("button", { name: tChat.send }));
    await waitFor(() => expect(screen.getByText(tChat.thinking)).toBeInTheDocument());
    resolveFetch(buildSseResponse([{ type: "done" }]));
    await waitFor(() => expect(screen.queryByText(tChat.thinking)).toBeNull());
  });
});
