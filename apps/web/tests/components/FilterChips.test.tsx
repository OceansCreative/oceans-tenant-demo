import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { FilterChips } from "@/components/search/FilterChips";

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParamsString = "";
});

describe("FilterChips", () => {
  it("適用中フィルタが 0 件のとき何も描画しない（null を返す）", () => {
    mockSearchParamsString = "";
    const { container } = render(<FilterChips />);
    expect(container.firstChild).toBeNull();
  });

  it("prefecture が URL にあるとき chip が表示される", () => {
    mockSearchParamsString = "prefecture=東京都";
    render(<FilterChips />);
    expect(screen.getByRole("region", { name: "適用中のフィルタ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "東京都 を解除" })).toBeInTheDocument();
  });

  it("複数フィルタが chip 化される（prefecture / minRent / buildingType）", () => {
    mockSearchParamsString = "prefecture=東京都&minRent=300000&buildingType=street_level";
    render(<FilterChips />);
    expect(screen.getByRole("button", { name: "東京都 を解除" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "賃料下限を解除" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "路面店 を解除" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "すべてクリア" })).toBeInTheDocument();
  });

  it("chip をクリックすると該当フィルタが URL から除去される", async () => {
    mockSearchParamsString = "prefecture=東京都&minRent=300000";
    const user = userEvent.setup();
    render(<FilterChips />);
    await user.click(screen.getByRole("button", { name: "東京都 を解除" }));
    expect(mockReplace).toHaveBeenCalled();
    const arg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(arg).not.toContain("prefecture=");
    expect(arg).toContain("minRent=300000");
  });

  it("「すべてクリア」を押すと /search に遷移する", async () => {
    mockSearchParamsString = "prefecture=東京都&buildingType=street_level";
    const user = userEvent.setup();
    render(<FilterChips />);
    await user.click(screen.getByRole("button", { name: "すべてクリア" }));
    const arg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(arg).toBe("/search");
  });

  it("buildingType の chip ラベルは enum→日本語ラベル（路面店）", () => {
    mockSearchParamsString = "buildingType=street_level";
    render(<FilterChips />);
    expect(screen.getByText("路面店")).toBeInTheDocument();
  });

  it("condition の chip ラベルは enum→日本語ラベル（スケルトン）", () => {
    mockSearchParamsString = "condition=skeleton";
    render(<FilterChips />);
    expect(screen.getByText("スケルトン")).toBeInTheDocument();
  });

  it("業種 ref (biz=category-cafe) は「カフェ」とラベリングされる", () => {
    mockSearchParamsString = "biz=category-cafe";
    render(<FilterChips />);
    expect(screen.getByText("カフェ")).toBeInTheDocument();
  });

  it("city フィルタ chip を解除すると URL から city が消える", async () => {
    mockSearchParamsString = "city=新宿区&prefecture=東京都";
    const user = userEvent.setup();
    render(<FilterChips />);
    await user.click(screen.getByRole("button", { name: "市区町村 新宿区 を解除" }));
    const arg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(arg).not.toContain("city=");
    expect(arg).toContain("prefecture=");
  });

  it("複数の buildingType chip のうち 1 つだけ解除できる", async () => {
    mockSearchParamsString = "buildingType=street_level&buildingType=basement";
    const user = userEvent.setup();
    render(<FilterChips />);
    await user.click(screen.getByRole("button", { name: "路面店 を解除" }));
    const arg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(arg).not.toContain("buildingType=street_level");
    expect(arg).toContain("buildingType=basement");
  });

  it("chip をクリックすると page=1 に戻る（ページネーション安全策）", async () => {
    mockSearchParamsString = "prefecture=東京都&page=3";
    const user = userEvent.setup();
    render(<FilterChips />);
    await user.click(screen.getByRole("button", { name: "東京都 を解除" }));
    const arg = mockReplace.mock.calls.at(-1)?.[0] as string;
    // page=1 はデフォルトのため URL から消える
    expect(arg).not.toContain("page=");
  });

  it("キーワード q もchip 化され、解除可能", async () => {
    mockSearchParamsString = "q=新宿";
    const user = userEvent.setup();
    render(<FilterChips />);
    expect(screen.getByText("キーワード: 新宿")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キーワード 新宿 を解除" }));
    const arg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(arg).toBe("/search");
  });

  it("追加クラスを併合できる", () => {
    mockSearchParamsString = "prefecture=東京都";
    const { container } = render(<FilterChips className="extra-cls" />);
    const region = container.querySelector('[data-testid="filter-chips"]');
    expect(region?.className).toMatch(/extra-cls/);
  });
});
