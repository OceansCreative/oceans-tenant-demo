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

import { ViewModeToggle } from "@/components/search/ViewModeToggle";

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParamsString = "";
});

describe("ViewModeToggle", () => {
  it("一覧と地図の 2 つのボタンを描画する", () => {
    render(<ViewModeToggle current="list" />);
    expect(screen.getByRole("button", { name: /一覧/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /地図/ })).toBeInTheDocument();
  });

  it("current=list のとき「一覧」が aria-pressed=true", () => {
    render(<ViewModeToggle current="list" />);
    expect(screen.getByRole("button", { name: /一覧/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /地図/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("current=map のとき「地図」が aria-pressed=true", () => {
    render(<ViewModeToggle current="map" />);
    expect(screen.getByRole("button", { name: /地図/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /一覧/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("地図ボタンを押すと view=map クエリ付きで replace が呼ばれる", async () => {
    const user = userEvent.setup();
    render(<ViewModeToggle current="list" />);
    await user.click(screen.getByRole("button", { name: /地図/ }));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).toContain("view=map");
  });

  it("一覧ボタンを押すと view クエリが削除される", async () => {
    mockSearchParamsString = "view=map";
    const user = userEvent.setup();
    render(<ViewModeToggle current="map" />);
    await user.click(screen.getByRole("button", { name: /一覧/ }));
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).not.toContain("view=");
  });

  it("既存のクエリ（prefecture など）は保持される", async () => {
    mockSearchParamsString = "prefecture=東京都";
    const user = userEvent.setup();
    render(<ViewModeToggle current="list" />);
    await user.click(screen.getByRole("button", { name: /地図/ }));
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).toContain("prefecture=");
    expect(arg).toContain("view=map");
  });

  it("fieldset に aria-label=表示モード が付与される", () => {
    render(<ViewModeToggle current="list" />);
    expect(screen.getByRole("group", { name: "表示モード" })).toBeInTheDocument();
  });

  it("追加クラスを併合できる", () => {
    const { container } = render(<ViewModeToggle current="list" className="extra-cls" />);
    const fieldset = container.querySelector("fieldset");
    expect(fieldset?.className).toMatch(/extra-cls/);
  });
});
