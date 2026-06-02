import type { Meta, StoryObj } from "@storybook/react";
import { SearchPagination } from "./SearchPagination";

/**
 * 検索結果ページネーション。
 *
 * - Server Component として `<Link>` のみで成立（JS なしでもナビゲート可）
 * - 現在ページを中央に最大 5 個のページ番号を出す
 * - 0 件 / 1 ページに収まる場合は何も描画しない（`render` の戻り値が `null`）
 */
const meta: Meta<typeof SearchPagination> = {
  title: "Search/SearchPagination",
  component: SearchPagination,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    currentPage: { control: { type: "number", min: 1 } },
    totalPages: { control: { type: "number", min: 1 } },
    totalCount: { control: { type: "number", min: 0 } },
    pageSize: { control: { type: "number", min: 1 } },
  },
  args: {
    buildHref: (page: number) => `/search?page=${page}`,
  },
};

export default meta;
type Story = StoryObj<typeof SearchPagination>;

export const FirstPage: Story = {
  name: "1 ページ目 / 全 10 ページ",
  args: {
    currentPage: 1,
    totalPages: 10,
    totalCount: 200,
    pageSize: 20,
  },
};

export const MiddlePage: Story = {
  name: "中央ページ / 全 10 ページ",
  args: {
    currentPage: 5,
    totalPages: 10,
    totalCount: 200,
    pageSize: 20,
  },
};

export const LastPage: Story = {
  name: "最終ページ / 全 10 ページ",
  args: {
    currentPage: 10,
    totalPages: 10,
    totalCount: 200,
    pageSize: 20,
  },
};

export const FewPages: Story = {
  name: "少ページ（3 ページ）",
  args: {
    currentPage: 2,
    totalPages: 3,
    totalCount: 45,
    pageSize: 20,
  },
};
