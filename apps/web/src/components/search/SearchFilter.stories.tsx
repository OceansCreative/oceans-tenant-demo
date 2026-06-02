import type { Meta, StoryObj } from "@storybook/react";
import { EMPTY_CRITERIA } from "@/lib/search-criteria";
import { SearchFilter } from "./SearchFilter";

/**
 * 検索画面サイドバーのフィルタ UI。
 *
 * - 都道府県 / 市区町村 / 賃料 / 面積 / 建物形態 / 物件状態 / 適合業種
 * - 変更ごとに `useTransition` で `router.replace` し、ページを 1 に戻す
 * - `@storybook/nextjs` のルータモックで挙動が成立する（実際のページ遷移は発生しない）
 */
const meta: Meta<typeof SearchFilter> = {
  title: "Search/SearchFilter",
  component: SearchFilter,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SearchFilter>;

export const Default: Story = {
  name: "初期状態",
  args: {
    initialCriteria: EMPTY_CRITERIA,
  },
};

export const WithPreset: Story = {
  name: "条件プリセット（東京 / カフェ）",
  args: {
    initialCriteria: {
      ...EMPTY_CRITERIA,
      prefecture: "東京都",
      minRent: 200000,
      maxRent: 600000,
      businessCategoryRefs: ["category-cafe"],
      buildingTypes: ["street_level"],
    },
  },
};

export const Compact: Story = {
  name: "コンパクト幅（モバイル想定）",
  args: {
    initialCriteria: EMPTY_CRITERIA,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-[360px]">
        <Story />
      </div>
    ),
  ],
};
