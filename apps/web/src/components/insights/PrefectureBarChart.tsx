"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PrefectureBucket } from "@/lib/insights/aggregate";
import { ChartFigure } from "./ChartFigure";
import { CHART_AXIS_COLOR, CHART_COLORS, CHART_GRID_COLOR } from "./chart-theme";

type PrefectureBarChartProps = {
  readonly buckets: ReadonlyArray<PrefectureBucket>;
};

/**
 * 都道府県別の件数（横軸＝都道府県、縦軸＝件数）の bar chart。
 *
 * - 既に集計時点で件数降順にソート済み
 * - 棒の色は 1 色固定（カテゴリ識別が不要なため）
 */
export const PrefectureBarChart = ({ buckets }: PrefectureBarChartProps): React.JSX.Element => {
  const t = useTranslations("insights.prefecture");
  const data = buckets.map((bucket) => ({ name: bucket.prefecture, value: bucket.count }));
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
              <th scope="col">{t("columnPrefecture")}</th>
              <th scope="col">{t("columnCount")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.name}>
                <th scope="row">{entry.name}</th>
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
          <XAxis dataKey="name" tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
};
