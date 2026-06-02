import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation のフック差し替え用モック
const mockReplace = vi.fn();
let mockSearchParamsString = "";
const mockSearchParams = {
  toString: () => mockSearchParamsString,
  get: (key: string) => {
    const params = new URLSearchParams(mockSearchParamsString);
    return params.get(key);
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

import { SearchBar } from "@/components/search/SearchBar";

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParamsString = "";
});

describe("SearchBar", () => {
  it("検索バーが aria-label と placeholder 付きで描画される", () => {
    render(<SearchBar />);
    const input = screen.getByRole("searchbox", { name: "物件をフリーテキストで検索" });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder");
  });

  it("初期値は URL クエリ q から復元される", () => {
    mockSearchParamsString = "q=新宿カフェ";
    render(<SearchBar />);
    const input = screen.getByRole<HTMLInputElement>("searchbox");
    expect(input.value).toBe("新宿カフェ");
  });

  it("入力した値が controlled で反映される", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole<HTMLInputElement>("searchbox");
    await user.type(input, "カフェ向け");
    expect(input.value).toBe("カフェ向け");
  });

  it("送信時に router.replace が q クエリ付きで呼ばれる", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole<HTMLInputElement>("searchbox");
    await user.type(input, "新宿");
    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).toContain("/search?");
    expect(arg).toContain("q=%E6%96%B0%E5%AE%BF");
    expect(arg).not.toContain("page=");
  });

  it("既存の他クエリは保持され、page だけは削除される", async () => {
    mockSearchParamsString = "prefecture=東京都&page=3";
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole<HTMLInputElement>("searchbox");
    await user.type(input, "カフェ");
    await user.click(screen.getByRole("button", { name: "検索" }));
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).toContain("prefecture=");
    expect(arg).toContain("q=");
    expect(arg).not.toContain("page=");
  });

  it("空文字または空白だけの送信では q が削除される", async () => {
    mockSearchParamsString = "q=旧キーワード";
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole<HTMLInputElement>("searchbox");
    await user.clear(input);
    await user.type(input, "   ");
    // Enter で submit
    await user.keyboard("{Enter}");
    expect(mockReplace).toHaveBeenCalled();
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).not.toContain("q=");
  });

  it("既存クエリが完全に空になった場合は ? なしの /search になる", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    // 何も入力せずに送信
    await user.click(screen.getByRole("button", { name: "検索" }));
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).toBe("/search");
  });

  it("Enter キーで submit される", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole<HTMLInputElement>("searchbox");
    await user.type(input, "テスト{Enter}");
    expect(mockReplace).toHaveBeenCalled();
  });

  it("追加クラスを受け取って search 要素に併合する", () => {
    const { container } = render(<SearchBar className="extra-cls" />);
    const searchEl = container.querySelector("search");
    expect(searchEl?.className).toMatch(/extra-cls/);
  });
});
