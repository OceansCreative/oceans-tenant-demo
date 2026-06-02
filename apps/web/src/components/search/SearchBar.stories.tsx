import type { Meta, StoryObj } from "@storybook/react";
import { SearchBar } from "./SearchBar";

/**
 * 検索画面ヘッダーのフリーテキスト検索バー。
 *
 * - `useRouter` / `useSearchParams` を `.storybook/mocks/next-navigation.ts` で
 *   薄くモック（router 呼び出しは console.info に書き出すだけの no-op）。
 * - 入力 / submit 時に `/search?q=...` へ `router.replace` するが Story 上は遷移しない。
 * - レイアウトは `<search>` 要素で囲まれ、SR でも検索バーであることが伝わる。
 */
const meta: Meta<typeof SearchBar> = {
  title: "Search/SearchBar",
  component: SearchBar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SearchBar>;

export const Default: Story = {
  name: "初期状態",
};

export const WithCustomClass: Story = {
  name: "カスタムクラス（max-w-md）",
  args: {
    className: "max-w-md",
  },
};
