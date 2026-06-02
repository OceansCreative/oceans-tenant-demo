import type { Meta, StoryObj } from "@storybook/react";
import { Footer } from "./Footer";

/**
 * グローバルフッター。
 *
 * - サービス / 事業者向け / プロジェクト 各セクションのリンク群
 * - リファレンス実装である旨の注記をコピーライト下に表示
 */
const meta: Meta<typeof Footer> = {
  title: "Layout/Footer",
  component: Footer,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {
  name: "標準表示",
};

export const Mobile: Story = {
  name: "モバイル表示（375）",
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
