/**
 * /studio — Sanity Studio v3 を Next.js に埋め込むエントリポイント。
 *
 * 実運用するには `apps/studio/sanity.config.ts` を read して `NextStudio` を
 * レンダリングする実装に置き換える必要がある（next-sanity の `NextStudio`）。
 *
 * 本リファレンス実装では、環境変数が未設定の状況を前提に親切な案内 UI を表示し、
 * 設定済みの場合は埋め込みを試みる構造にしておく。
 */
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sanity Studio",
  robots: { index: false, follow: false },
};

type PageProps = {
  readonly params: Promise<{ tool?: string[] }>;
};

const StudioEmbedPage = async ({ params: _params }: PageProps): Promise<React.JSX.Element> => {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

  if (!projectId || !dataset) {
    return (
      <div className="container-page py-16">
        <section className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-900">
          <h1 className="text-xl font-bold">Sanity Studio は未設定です</h1>
          <p className="mt-3 text-sm leading-relaxed">
            <code className="rounded bg-white px-1 py-0.5">NEXT_PUBLIC_SANITY_PROJECT_ID</code> と{" "}
            <code className="rounded bg-white px-1 py-0.5">NEXT_PUBLIC_SANITY_DATASET</code> を
            .env.local もしくは Vercel の環境変数に設定すると、ここに Sanity Studio
            が埋め込まれます。
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
            <li>
              <a
                href="https://www.sanity.io/manage"
                target="_blank"
                rel="noreferrer noopener"
                className="text-brand-700 underline"
              >
                Sanity 管理画面
              </a>
              でプロジェクトを作成
            </li>
            <li>Project ID と Dataset 名を環境変数に設定</li>
            <li>
              <code className="rounded bg-white px-1 py-0.5">apps/studio</code> ディレクトリで
              <code className="ml-1 rounded bg-white px-1 py-0.5">pnpm sanity deploy</code> もしくは
              本ルートで埋め込み実装に切り替え
            </li>
          </ol>
          <div className="mt-6">
            <Link href="/" className="text-sm font-medium text-brand-700 hover:underline">
              ← ホームに戻る
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <section className="rounded-2xl border border-neutral-200 bg-white p-8">
        <h1 className="text-xl font-bold text-neutral-900">Sanity Studio 接続準備済み</h1>
        <p className="mt-2 text-sm text-neutral-700">
          プロジェクト ID <code className="rounded bg-neutral-100 px-1">{projectId}</code> ／
          データセット <code className="rounded bg-neutral-100 px-1">{dataset}</code> に接続します。
        </p>
        <p className="mt-3 text-xs text-neutral-500">
          ※ 完全な Studio 埋め込みは{" "}
          <code className="rounded bg-neutral-100 px-1">next-sanity</code> の
          <code className="ml-1 rounded bg-neutral-100 px-1">NextStudio</code>{" "}
          導入時に有効化されます。 現状はプレースホルダーです。
        </p>
      </section>
    </div>
  );
};

export default StudioEmbedPage;
