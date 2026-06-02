/**
 * /insights ダッシュボードで使う共通の chart カラーパレット。
 *
 * - Tailwind の `brand-*` トークンと neutral 色を混ぜたカテゴリ色 6 段階
 * - recharts は `fill` / `stroke` 属性に CSS 文字列を直接指定する設計なので、
 *   `oklch` も理論上は受け取れるが、SVG レンダラの互換性を優先して 16 進値で持つ
 * - 軸 / 文字色は Tailwind の neutral-700 相当に揃える
 */
export const CHART_COLORS = [
  "#1f4f9e", // brand-600 相当
  "#3a7bd5", // brand-500 相当（明）
  "#7fb1e6",
  "#a3c4eb",
  "#cfd8e3",
  "#737373", // neutral-500
] as const;

export const CHART_AXIS_COLOR = "#404040"; // neutral-700
export const CHART_GRID_COLOR = "#e5e5e5"; // neutral-200
