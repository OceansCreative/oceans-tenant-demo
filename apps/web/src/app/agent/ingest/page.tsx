import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { IngestForm } from "@/components/agent/IngestForm";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("agent.ingest");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
};

const AgentIngestPage = async (): Promise<React.JSX.Element> => {
  const t = await getTranslations("agent.ingest");
  return (
    <div className="container-page py-10">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-bold text-neutral-900">{t("pageTitle")}</h1>
        <p className="text-sm text-neutral-600">{t("lead")}</p>
      </header>
      <IngestForm />
    </div>
  );
};

export default AgentIngestPage;
