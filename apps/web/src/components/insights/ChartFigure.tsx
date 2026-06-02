import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ChartFigureProps = {
  readonly title: string;
  readonly caption: string;
  readonly tableLabel: string;
  readonly emptyMessage: string;
  readonly isEmpty: boolean;
  readonly children: ReactNode;
  readonly table: ReactNode;
  readonly className?: string;
};

/**
 * /insights の各チャート共通レイアウト。
 *
 * a11y 戦略:
 * - `<figure>` + `<figcaption>` で「グラフの説明文」を読み上げ可能にする
 * - グラフ本体は SVG なので、視覚的に同じ値を持つ `<table>` を `.sr-only` で併記
 *   → スクリーンリーダーは表から数値を直接読み取れる
 * - 空状態は SVG を描画せず、テキストでフォールバックする（recharts は 0 件で描画が崩れるため）
 *
 * 視覚レイアウトは:
 * - タイトル / 本体（chart or empty） / キャプション / sr-only テーブル
 */
export const ChartFigure = ({
  title,
  caption,
  tableLabel,
  emptyMessage,
  isEmpty,
  children,
  table,
  className,
}: ChartFigureProps): React.JSX.Element => {
  return (
    <figure
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {isEmpty ? (
        <p className="rounded-xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="h-72 w-full">{children}</div>
      )}
      <figcaption className="text-xs text-neutral-500">{caption}</figcaption>
      {!isEmpty && (
        <section className="sr-only" aria-label={tableLabel}>
          {table}
        </section>
      )}
    </figure>
  );
};
