"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatJpyCompact } from "@/lib/format";
import type { RentHistogramBin } from "@/lib/insights/aggregate";
import { ChartFigure } from "./ChartFigure";
import { CHART_AXIS_COLOR, CHART_COLORS, CHART_GRID_COLOR } from "./chart-theme";

type RentDistributionProps = {
  readonly bins: ReadonlyArray<RentHistogramBin>;
};

/**
 * 賃料ヒストグラム（bar chart）。
 *
 * - X 軸ラベルは compact 表記の min 値（例: ¥10 万）
 * - 0 件 bin も表示（分布の谷を可視化するため）
 * - bin が 1 件もない（入力空配列）の場合は空状態にフォールバック
 */
export const RentDistribution = ({ bins }: RentDistributionProps): React.JSX.Element => {
  const t = useTranslations("insights.rent");
  const data = useMemo(
    () =>
      bins.map((bin) => ({
        name: formatJpyCompact(bin.min),
        rangeLabel: t("binLabel", {
          min: formatJpyCompact(bin.min),
          max: formatJpyCompact(bin.max),
        }),
        value: bin.count,
      })),
    [bins, t],
  );
  const isEmpty = data.length === 0;

  return (
    <ChartFigure
      title={t("title")}
      caption={t("caption")}
      tableLabel={t("tableLabel")}
      emptyMessage={t("empty")}
      isEmpty={isEmpty}
      table={
        <table>
          <thead>
            <tr>
              <th scope="col">{t("columnRange")}</th>
              <th scope="col">{t("columnCount")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.name}>
                <th scope="row">{entry.rangeLabel}</th>
                <td>{entry.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis allowDecimals={false} tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
};
