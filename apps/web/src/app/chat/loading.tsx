/**
 * `/chat` 用 loading UI。ChatPanel は client component なので、Server 側の RSC ペイロード
 * 生成が短時間でも、最初のフレームを即座に返して FCP を改善する。
 */
const ChatLoading = (): React.JSX.Element => {
  return (
    <div aria-busy="true" aria-live="polite" className="container-page py-8">
      <header className="mb-6 space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-neutral-100" />
      </header>
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="h-[calc(100vh-12rem)] animate-pulse rounded-2xl bg-neutral-100" />
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
          <div className="h-72 animate-pulse rounded-2xl bg-neutral-100" />
        </div>
      </div>
      <p className="sr-only">対話画面を準備中です…</p>
    </div>
  );
};

export default ChatLoading;
