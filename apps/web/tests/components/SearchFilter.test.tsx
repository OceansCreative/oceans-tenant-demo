import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import jaMessages from "../../messages/ja.json";
import { renderWithI18n } from "../test-utils";

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

import { SearchFilter } from "@/components/search/SearchFilter";

const tFilter = jaMessages.search.filter;
const tEnumBuilding = jaMessages.enum.buildingType;
const tEnumCondition = jaMessages.enum.condition;
const tCategory = jaMessages.search.businessCategory;

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParamsString = "";
});

describe("SearchFilter", () => {
  it("aria-label を持つランドマークとして描画される", () => {
    renderWithI18n(<SearchFilter />);
    expect(screen.getByRole("complementary", { name: tFilter.ariaLabel })).toBeInTheDocument();
  });

  it("見出しと「条件をクリア」ボタンが表示される", () => {
    renderWithI18n(<SearchFilter />);
    expect(screen.getByText(tFilter.heading)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: tFilter.clear })).toBeInTheDocument();
  });

  it("都道府県セレクトを変更すると router.replace が prefecture 付きで呼ばれる", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    const select = screen.getByLabelText(tFilter.prefecture);
    await user.selectOptions(select, "東京都");
    expect(mockReplace).toHaveBeenCalled();
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).toContain("prefecture=");
  });

  it("市区町村テキストを入力すると router.replace が city 付きで呼ばれる", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    const cityInput = screen.getByLabelText(tFilter.cityAriaLabel);
    await user.type(cityInput, "新宿区");
    expect(mockReplace).toHaveBeenCalled();
    const lastArg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastArg).toContain("city=");
  });

  it("賃料下限を入力すると minRent クエリが追加される", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    const minRent = screen.getByLabelText(tFilter.rentMinAriaLabel);
    await user.type(minRent, "300000");
    const lastArg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastArg).toContain("minRent=");
  });

  it("賃料上限を入力すると maxRent クエリが追加される", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    const maxRent = screen.getByLabelText(tFilter.rentMaxAriaLabel);
    await user.type(maxRent, "500000");
    const lastArg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastArg).toContain("maxRent=");
  });

  it("面積下限と上限を入力すると minArea / maxArea クエリが追加される", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    await user.type(screen.getByLabelText(tFilter.areaMinAriaLabel), "20");
    await user.type(screen.getByLabelText(tFilter.areaMaxAriaLabel), "40");
    const allArgs = mockReplace.mock.calls.map((call) => call[0] as string).join("\n");
    expect(allArgs).toMatch(/minArea=/);
    expect(allArgs).toMatch(/maxArea=/);
  });

  it("建物形態ボタンを押すと aria-pressed が切り替わり buildingType が URL に入る", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    const button = screen.getByRole("button", { name: tEnumBuilding.street_level });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    const lastArg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastArg).toContain("buildingType=street_level");
  });

  it("物件状態ボタン（スケルトン）を押すと condition が URL に入る", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    await user.click(screen.getByRole("button", { name: tEnumCondition.skeleton }));
    const lastArg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastArg).toContain("condition=skeleton");
  });

  it("適合業種ボタン（カフェ）を押すと biz=category-cafe が URL に入る", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    await user.click(screen.getByRole("button", { name: tCategory.cafe }));
    const lastArg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastArg).toContain("biz=category-cafe");
  });

  it("選択中のチップを再度押すと選択が解除される（trip toggle）", async () => {
    mockSearchParamsString = "buildingType=street_level";
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    const button = screen.getByRole("button", { name: tEnumBuilding.street_level });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await user.click(button);
    const lastArg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastArg).not.toContain("buildingType=street_level");
  });

  it("「条件をクリア」を押すと router.replace が ? なしの /search で呼ばれる", async () => {
    mockSearchParamsString = "prefecture=東京都&city=新宿区&minRent=300000";
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    await user.click(screen.getByRole("button", { name: tFilter.clear }));
    expect(mockReplace).toHaveBeenCalled();
    const arg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(arg).toBe("/search");
  });

  it("URL クエリから初期値が復元される（都道府県セレクト）", () => {
    mockSearchParamsString = "prefecture=東京都";
    renderWithI18n(<SearchFilter />);
    const select = screen.getByLabelText<HTMLSelectElement>(tFilter.prefecture);
    expect(select.value).toBe("東京都");
  });

  it("URL クエリの city が初期入力値に反映される", () => {
    mockSearchParamsString = "city=新宿区";
    renderWithI18n(<SearchFilter />);
    const cityInput = screen.getByLabelText<HTMLInputElement>(tFilter.cityAriaLabel);
    expect(cityInput.value).toBe("新宿区");
  });

  it("空の都道府県を選択すると prefecture クエリが消える", async () => {
    mockSearchParamsString = "prefecture=東京都";
    const user = userEvent.setup();
    renderWithI18n(<SearchFilter />);
    const select = screen.getByLabelText(tFilter.prefecture);
    await user.selectOptions(select, "");
    const lastArg = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastArg).not.toContain("prefecture=");
  });

  it("追加クラスを併合できる", () => {
    const { container } = renderWithI18n(<SearchFilter className="extra-cls" />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toMatch(/extra-cls/);
  });

  it("初期 URL クエリの buildingType / condition / biz がチップに反映される", () => {
    mockSearchParamsString = "buildingType=street_level&condition=skeleton&biz=category-cafe";
    renderWithI18n(<SearchFilter />);
    expect(screen.getByRole("button", { name: tEnumBuilding.street_level })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: tEnumCondition.skeleton })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: tCategory.cafe })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("locale=en では英語ラベルで主要要素が描画される", () => {
    renderWithI18n(<SearchFilter />, { locale: "en" });
    expect(screen.getByRole("complementary", { name: "Search filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skeleton" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cafe" })).toBeInTheDocument();
  });
});
