import type { Meta, StoryObj } from "@storybook/react";
import { Header } from "./Header";

/**
 * グローバルヘッダー。
 *
 * - ロゴ / 主要ナビゲーション / 「物件を登録」CTA / モバイル時はハンバーガー
 * - sticky + 半透明 + backdrop-blur で全画面共通の固定ヘッダーとして使われる
 */
const meta: Meta<typeof Header> = {
  title: "Layout/Header",
  component: Header,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Default: Story = {
  name: "デスクトップ表示",
};

export const Mobile: Story = {
  name: "モバイル表示（375）",
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "タブレット表示（768）",
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
