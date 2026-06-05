import type { Meta, StoryObj } from "@storybook/react";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { PropertyEditForm } from "./PropertyEditForm";

/**
 * Admin の物件編集 / 新規作成フォーム。
 *
 * - 新規モード: `initial` 未指定で render
 * - 編集モード: `initial` に既存物件を渡す。slug が disabled、削除ボタンが表示される
 *
 * mock データは `apps/web/src/lib/sanity/mock-properties.ts` を使用（実在物件は混入させない）。
 */
const meta: Meta<typeof PropertyEditForm> = {
  title: "Admin/PropertyEditForm",
  component: PropertyEditForm,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-4xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PropertyEditForm>;

const sample = MOCK_PROPERTIES[0];
if (!sample) throw new Error("MOCK_PROPERTIES が空です");
// `MOCK_PROPERTIES` は派生型 `PropertyWithTsubo`。`tsubo` は派生値のため Property に変換する。
const { tsubo: _tsubo, ...sampleProperty } = sample;

export const NewMode: Story = {
  name: "新規作成モード（initial 無し）",
};

export const EditMode: Story = {
  name: "編集モード（initial あり）",
  args: {
    initial: sampleProperty,
  },
};
