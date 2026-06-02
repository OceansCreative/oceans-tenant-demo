import type { Meta, StoryObj } from "@storybook/react";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { RelatedProperties } from "./RelatedProperties";

/**
 * 物件詳細ページ下部に表示する「関連物件」セクション。
 *
 * - Server Component（クライアント側ロジックなし）
 * - `properties` が空のときはセクション自体を描画しない（呼び出し側のレイアウト崩れ防止）
 * - `PropertyCard` を再利用し、レスポンシブ grid（1 / 2 / 3 カラム）で並べる
 *
 * 物件データは `apps/web/src/lib/sanity/mock-properties.ts` を流用する（実在物件は混入させない）。
 */
const meta: Meta<typeof RelatedProperties> = {
  title: "Property/RelatedProperties",
  component: RelatedProperties,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-6xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RelatedProperties>;

export const ThreeItems: Story = {
  name: "3 件表示（grid sm:2 / lg:3）",
  args: {
    properties: MOCK_PROPERTIES.slice(0, 3),
  },
};

export const FiveItems: Story = {
  name: "5 件表示（折り返しレイアウト）",
  args: {
    properties: MOCK_PROPERTIES,
  },
};
