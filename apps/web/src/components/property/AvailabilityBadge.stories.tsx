import type { Meta, StoryObj } from "@storybook/react";
import { AvailabilityBadge } from "./AvailabilityBadge";

/**
 * 物件の公開ステータスを 3 種類のカラーバリエーションで提示するバッジ。
 *
 * - `public`: 公開中（緑）
 * - `negotiating`: 商談中（黄）
 * - `closed`: 取扱終了（グレー）
 *
 * `PropertyCard` 内で右上に重ねて使用される。色だけでなくテキストでも判別できるよう
 * `availabilityLabel` を表示している（a11y / 色覚バリアフリー）。
 */
const meta: Meta<typeof AvailabilityBadge> = {
  title: "Property/AvailabilityBadge",
  component: AvailabilityBadge,
  tags: ["autodocs"],
  argTypes: {
    availability: {
      control: { type: "select" },
      options: ["public", "negotiating", "closed"],
      description: "物件の取扱ステータス",
    },
    className: {
      control: { type: "text" },
      description: "追加 Tailwind クラス",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AvailabilityBadge>;

export const Public: Story = {
  name: "公開中",
  args: {
    availability: "public",
  },
};

export const Negotiating: Story = {
  name: "商談中",
  args: {
    availability: "negotiating",
  },
};

export const Closed: Story = {
  name: "取扱終了",
  args: {
    availability: "closed",
  },
};

export const AllVariants: Story = {
  name: "全バリアント並列表示",
  render: () => (
    <div className="flex flex-wrap gap-3">
      <AvailabilityBadge availability="public" />
      <AvailabilityBadge availability="negotiating" />
      <AvailabilityBadge availability="closed" />
    </div>
  ),
};
