import type { Meta, StoryObj } from "@storybook/react";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { PropertyCard } from "./PropertyCard";

/**
 * 検索結果 / 対話結果 / 取り込みプレビュー など、物件の単票を表示する基本カード。
 *
 * - 画像プレースホルダ（ブランドグラデーション）
 * - 物件名 / 住所 / 最寄駅 / 賃料 / 面積 / 坪換算
 * - `<Link prefetch={false}>` で詳細ページへ遷移（v0.6.0 WS-2 で TBT 改善）
 *
 * mock データは `apps/web/src/lib/sanity/mock-properties.ts` を使用（実在物件は混入させない）。
 */
const meta: Meta<typeof PropertyCard> = {
  title: "Property/PropertyCard",
  component: PropertyCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PropertyCard>;

const [shinjuku, osaka, fukuoka, shibuya, minato] = MOCK_PROPERTIES;

export const Default: Story = {
  name: "公開中 / 路面店",
  args: {
    // biome-ignore lint/style/noNonNullAssertion: MOCK_PROPERTIES は静的配列で必ず 5 件存在する
    property: shinjuku!,
  },
};

export const Negotiating: Story = {
  name: "商談中 / 居抜き",
  args: {
    // biome-ignore lint/style/noNonNullAssertion: MOCK_PROPERTIES は静的配列で必ず 5 件存在する
    property: osaka!,
  },
};

export const HighRent: Story = {
  name: "高賃料 / オフィス区画",
  args: {
    // biome-ignore lint/style/noNonNullAssertion: MOCK_PROPERTIES は静的配列で必ず 5 件存在する
    property: minato!,
  },
};

export const Grid: Story = {
  name: "グリッドレイアウト（検索結果想定）",
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[shinjuku, osaka, fukuoka, shibuya, minato].map((property) =>
        property ? (
          <li key={property.slug}>
            <PropertyCard property={property} className="h-full" />
          </li>
        ) : null,
      )}
    </ul>
  ),
};
