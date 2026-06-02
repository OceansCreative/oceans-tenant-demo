import type { Meta, StoryObj } from "@storybook/react";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { PropertyMapLazy } from "./PropertyMapLazy";

/**
 * `PropertyMap` を `next/dynamic` で client-only ロードする薄いラッパ。
 *
 * - SSR / 初回描画では `aspect-video` 相当のスケルトン（pulse）を表示する
 * - Storybook では `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 未設定のため、
 *   client load 完了後は `PropertyMap` の「API キー未設定」プレースホルダが描画される
 * - Lighthouse CLS を 0 に保つため、loading / 本体 / 無効化 placeholder のサイズを揃えている
 *
 * 実地図タイルの fetch は story では発生しない（`PropertyMap.stories` と同様の方針）。
 */
const meta: Meta<typeof PropertyMapLazy> = {
  title: "Map/PropertyMapLazy",
  component: PropertyMapLazy,
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
type Story = StoryObj<typeof PropertyMapLazy>;

export const WithProperties: Story = {
  name: "物件あり（dynamic → API キー未設定 placeholder）",
  args: {
    properties: MOCK_PROPERTIES,
  },
};

export const Empty: Story = {
  name: "物件 0 件（dynamic → empty placeholder）",
  args: {
    properties: [],
  },
};
