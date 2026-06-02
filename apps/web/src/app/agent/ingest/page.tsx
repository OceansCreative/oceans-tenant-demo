import type { Metadata } from "next";
import { IngestForm } from "@/components/agent/IngestForm";

export const metadata: Metadata = {
  title: "URL から物件を取り込む",
  description: "物件掲載ページの URL を AI が自動で読み取り、ドラフトに保存します。",
};

const AgentIngestPage = (): React.JSX.Element => {
  return (
    <div className="container-page py-10">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-bold text-neutral-900">URL から物件を取り込む</h1>
        <p className="text-sm text-neutral-600">
          物件掲載ページの URL を貼り付けると、AI が情報を自動で読み取ります。
          抽出結果を確認してから Sanity に保存できます。
        </p>
      </header>
      <IngestForm />
    </div>
  );
};

export default AgentIngestPage;
