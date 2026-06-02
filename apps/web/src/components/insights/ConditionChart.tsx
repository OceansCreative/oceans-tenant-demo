"use client";

import { conditionLabel } from "@oceans-tenant/shared";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ConditionBucket } from "@/lib/insights/aggregate";
import { ChartFigure } from "./ChartFigure";
import { CHART_AXIS_COLOR, CHART_COLORS, CHART_GRID_COLOR } from "./chart-theme";

type ConditionChartProps = {
  readonly buckets: ReadonlyArray<ConditionBucket>;
};

/**
 * 物件状態（スケルトン / 居抜き / 造作譲渡）の bar chart。
 *
 * 件数 0 のキーも表示する（カテゴリ集合自体は固定の 3 値なので、欠落は意味を持つ）。
 * 全件 0 の場合のみ空状態。
 */
export const ConditionChart = ({ buckets }: ConditionChartProps): React.JSX.Element => {
  const t = useTranslations("insights.condition");
  const data = useMemo(
    () =>
      buckets.map((bucket) => ({
        key: bucket.key,
        name: conditionLabel[bucket.key],
        value: bucket.count,
      })),
    [buckets],
  );
  const isEmpty = data.every((entry) => entry.value === 0);

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
              <th scope="col">{t("columnCondition")}</th>
              <th scope="col">{t("columnCount")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.key}>
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
          <Bar dataKey="value" fill={CHART_COLORS[2]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
};
