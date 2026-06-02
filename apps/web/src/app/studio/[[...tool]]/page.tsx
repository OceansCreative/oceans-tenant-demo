/**
 * /studio — Sanity Studio v3 を Next.js に埋め込むエントリポイント。
 *
 * - 環境変数 `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` が
 *   両方設定されている場合は `next-sanity` の `NextStudio` で Studio を埋め込む。
 * - いずれかが未設定の場合は、設定手順を案内する親切なフォールバック UI を表示する。
 *
 * NextStudio は Client Component であり、Studio 自体が動的にルーティングを取り回すため、
 * Next.js 側では Studio を内包したセグメントを完全に Studio に委譲する。
 */

import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { StudioClient } from "./StudioClient";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sanity Studio",
  robots: { index: false, follow: false },
};

// NextStudio が要求する viewport 設定（Studio はモバイル UI を独自最適化するため）。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const StudioEmbedPage = async (): Promise<React.JSX.Element> => {
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

  return <StudioClient />;
};

export default StudioEmbedPage;
