import type { Meta, StoryObj } from "@storybook/react";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { PropertyMap } from "./PropertyMap";

/**
 * Google Maps による物件マップビュー。
 *
 * - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` が未設定の場合は無効化プレースホルダを表示する
 * - Storybook では API キーを設定しない方針（Map タイルを実 fetch しない）
 *
 * → Story 上では「無効化プレースホルダ」のレイアウト確認に専念する。
 *   実際の地図表示は `pnpm dev` + `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 環境下で検証する。
 */
const meta: Meta<typeof PropertyMap> = {
  title: "Map/PropertyMap",
  component: PropertyMap,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto h-[520px] w-full max-w-5xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PropertyMap>;

export const PlaceholderWithProperties: Story = {
  name: "API キー未設定（5 件分のプレースホルダ）",
  args: {
    properties: MOCK_PROPERTIES,
  },
};

export const PlaceholderEmpty: Story = {
  name: "API キー未設定 / 物件 0 件",
  args: {
    properties: [],
  },
};
