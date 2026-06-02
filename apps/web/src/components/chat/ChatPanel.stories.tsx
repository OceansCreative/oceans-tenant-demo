import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { ChatPanel } from "./ChatPanel";

/**
 * 対話型検索 UI のメイン枠。
 *
 * - 左ペイン: チャット履歴 + 入力フォーム
 * - 右ペイン: 抽出条件（JSON）+ ヒット物件カード
 *
 * 内部状態は `useState` で完結し、サーバとは `/api/chat-search` の SSE 経由でやり取りする。
 * Storybook では SSE エンドポイントが存在しないため、Story では送信操作は行わず
 * 「初期描画」のレイアウト確認のみに用途を絞る（モックを噛ませる手間に対する価値が低いため）。
 *
 * セッション ID は内部の `generateUuidV4()` または URL クエリ `sessionId` から復元する。
 * `WithSessionId` Story では `window.history.replaceState` で固定 ID を仕込み、
 * 描画スナップショットを安定化させる。
 */
const meta: Meta<typeof ChatPanel> = {
  title: "Chat/ChatPanel",
  component: ChatPanel,
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
type Story = StoryObj<typeof ChatPanel>;

const useFixedSessionId = (sessionId: string | null): void => {
  useEffect(() => {
    const original = `${window.location.pathname}${window.location.search}`;
    const query = sessionId ? `?sessionId=${sessionId}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
    return () => {
      window.history.replaceState(null, "", original);
    };
  }, [sessionId]);
};

const FreshWrapper = (): React.JSX.Element => {
  useFixedSessionId(null);
  return <ChatPanel />;
};

const FixedSessionWrapper = (): React.JSX.Element => {
  // ランダムな実 ID ではなく、UUID v4 形式に合致する固定値を渡してスナップショットを安定化
  useFixedSessionId("12345678-1234-4abc-89ab-1234567890ab");
  return <ChatPanel />;
};

export const Empty: Story = {
  name: "初期状態（履歴なし / セッション新規発行）",
  render: () => <FreshWrapper />,
};

export const WithSessionId: Story = {
  name: "セッション ID 復元（URL クエリ経由）",
  render: () => <FixedSessionWrapper />,
};
