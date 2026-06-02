import type { Meta, StoryObj } from "@storybook/react";
import { ViewModeToggle } from "./ViewModeToggle";

/**
 * 検索結果ビューを「一覧」「地図」で切り替えるトグル。
 *
 * - `aria-pressed` で選択状態を SR に伝える
 * - クリック時に `useTransition` で `/search?view=...` を `router.replace`
 */
const meta: Meta<typeof ViewModeToggle> = {
  title: "Search/ViewModeToggle",
  component: ViewModeToggle,
  tags: ["autodocs"],
  argTypes: {
    current: {
      control: { type: "inline-radio" },
      options: ["list", "map"],
      description: "現在の表示モード",
    },
  },
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ViewModeToggle>;

export const ListActive: Story = {
  name: "一覧モード",
  args: {
    current: "list",
  },
};

export const MapActive: Story = {
  name: "地図モード",
  args: {
    current: "map",
  },
};
