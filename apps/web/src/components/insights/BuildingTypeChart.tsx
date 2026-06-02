"use client";

import { buildingTypeLabel } from "@oceans-tenant/shared";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { BuildingTypeBucket } from "@/lib/insights/aggregate";
import { ChartFigure } from "./ChartFigure";
import { CHART_COLORS } from "./chart-theme";

type BuildingTypeChartProps = {
  readonly buckets: ReadonlyArray<BuildingTypeBucket>;
};

/**
 * 建物形態の内訳（Pie / Donut Chart）。
 *
 * - 件数 0 のキーは表示候補から除外（ラベルが過剰になるため）
 * - 全件 0 のときは ChartFigure 側の空状態にフォールバック
 * - recharts は CSR 限定 → "use client" 必須
 */
export const BuildingTypeChart = ({ buckets }: BuildingTypeChartProps): React.JSX.Element => {
  const t = useTranslations("insights.buildingType");
  const data = useMemo(
    () =>
      buckets
        .filter((bucket) => bucket.count > 0)
        .map((bucket) => ({
          key: bucket.key,
          name: buildingTypeLabel[bucket.key],
          value: bucket.count,
        })),
    [buckets],
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
              <th scope="col">{t("columnType")}</th>
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
        <PieChart role="img" aria-label={t("title")}>
          <Pie
            data={[...data]}
            dataKey="value"
            nameKey="name"
            innerRadius="40%"
            outerRadius="70%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell key={entry.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
};
