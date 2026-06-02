import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("chat");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
};

export const dynamic = "force-dynamic";

const ChatPage = async (): Promise<React.JSX.Element> => {
  const t = await getTranslations("chat");
  return (
    <div className="container-page py-8">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold text-neutral-900">{t("pageTitle")}</h1>
        <p className="text-sm text-neutral-600">{t("pageLead")}</p>
      </header>
      <ChatPanel />
    </div>
  );
};

export default ChatPage;
