import Link from "next/link";

const HomePage = (): React.JSX.Element => {
  return (
    <div className="container-page py-16 lg:py-24">
      <section className="grid items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
            AI × 店舗物件マッチング
          </p>
          <h1 className="text-balance text-4xl font-bold leading-tight text-neutral-900 sm:text-5xl">
            URL をペーストするだけで、
            <br className="hidden sm:block" />
            AI が物件情報を構造化抽出します。
          </h1>
          <p className="text-pretty text-lg leading-relaxed text-neutral-600">
            自然言語での対話型検索、地図ビュー、構造化データ管理を統合した
            店舗物件マッチングのリファレンス実装です。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              物件を探す
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-6 py-3 text-base font-medium text-neutral-800 transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              対話で探す
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-[4/3] w-full rounded-3xl bg-gradient-to-br from-brand-50 via-white to-brand-100 p-6 shadow-sm ring-1 ring-brand-100/60">
            <div className="grid h-full grid-cols-2 gap-4">
              {[
                { title: "URL 抽出", body: "掲載 URL から AI で構造化" },
                { title: "対話型検索", body: "条件を話しかけて絞り込む" },
                { title: "地図ビュー", body: "Google Maps と連携" },
                { title: "Sanity CMS", body: "構造化データ管理" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-white/80 p-4 ring-1 ring-neutral-200/80 backdrop-blur"
                >
                  <p className="text-sm font-semibold text-brand-700">{item.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-24 grid gap-8 sm:grid-cols-3">
        {[
          {
            title: "URL → 構造化",
            body: "物件掲載ページの URL を投入すると、AI が要素を抽出して Sanity のドラフトに保存します。",
          },
          {
            title: "対話で絞り込む",
            body: "「新宿で 30 坪のカフェ向け」のような自然言語条件から、GROQ クエリを生成して検索します。",
          },
          {
            title: "OSS リファレンス",
            body: "Next.js 15 / Sanity v3 / Claude API / Tailwind v4 / Playwright の組み合わせ実装例。",
          },
        ].map((feature) => (
          <article
            key={feature.title}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-neutral-900">{feature.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">{feature.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

export default HomePage;
