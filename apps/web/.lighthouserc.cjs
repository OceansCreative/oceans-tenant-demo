/**
 * Lighthouse CI 設定（apps/web 配下）
 *
 * - `/`, `/search`, `/chat`, `/properties/[slug]`（mock の固定 slug）の 4 ページを計測
 * - numberOfRuns: 3（中央値で評価）
 * - chrome flags: --no-sandbox --headless（CI 想定）
 * - 結果は GitHub Actions のアーティファクトとして保存（filesystemPath）
 *
 * assertions の方針:
 * - performance: 0.9 厳格（v0.6.0 WS-2 で next/font 適用 / next/dynamic / Suspense / prefetch
 *   調整 / SSG / images.formats / compress を入れて 90+ を恒常達成できる構成に整えた）
 * - accessibility: 0.95 厳格（A11y は退行を許容しない）
 * - best-practices: 0.90 厳格
 * - seo: 0.90 厳格
 *
 * `aggregationMethod: "median-run"` は 3 ラン中央値で判定するため、外れ値 1 ランで落ちない。
 */
module.exports = {
  ci: {
    collect: {
      // next start で起動済みサーバーに対して計測する想定（workflow 側で起動）
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/search",
        "http://localhost:3000/chat",
        "http://localhost:3000/properties/sample-shinjuku-sanchome-street",
      ],
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        chromeFlags: "--no-sandbox --headless",
      },
    },
    assert: {
      assertions: {
        "categories:performance": [
          "error",
          { minScore: 0.9, aggregationMethod: "median-run" },
        ],
        "categories:accessibility": [
          "error",
          { minScore: 0.95, aggregationMethod: "median-run" },
        ],
        "categories:best-practices": [
          "error",
          { minScore: 0.9, aggregationMethod: "median-run" },
        ],
        "categories:seo": [
          "error",
          { minScore: 0.9, aggregationMethod: "median-run" },
        ],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
    },
  },
};
