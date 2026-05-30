import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const metadata: Metadata = {
  title: "対話で物件を探す",
  description: "自然言語の対話で店舗物件を絞り込みます。",
};

const ChatPage = (): React.JSX.Element => {
  return (
    <div className="container-page py-8">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold text-neutral-900">対話で物件を探す</h1>
        <p className="text-sm text-neutral-600">
          自然言語で条件を伝えると、AI が条件を抽出してリアルタイムに結果を更新します。
        </p>
      </header>
      <Suspense
        fallback={
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500">
            読み込み中…
          </div>
        }
      >
        <ChatPanel />
      </Suspense>
    </div>
  );
};

export default ChatPage;
