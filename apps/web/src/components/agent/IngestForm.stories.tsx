import type { Meta, StoryObj } from "@storybook/react";
import { IngestForm } from "./IngestForm";

/**
 * 不動産会社が物件 URL をペーストして AI 構造化抽出を試すフォーム。
 *
 * - URL 入力 / 抽出ボタン / 結果プレビュー（信頼度バー + PropertyCard）
 * - 実際の `/api/ingest-url` 呼び出しは Storybook 上では失敗する（API キー未設定）
 *   ため、初期状態のレイアウト確認に絞った story を提供する。
 */
const meta: Meta<typeof IngestForm> = {
  title: "Agent/IngestForm",
  component: IngestForm,
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
type Story = StoryObj<typeof IngestForm>;

export const Default: Story = {
  name: "初期状態（URL 未入力）",
};

export const Compact: Story = {
  name: "コンパクト幅（タブレット相当）",
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-[720px]">
        <Story />
      </div>
    ),
  ],
};
