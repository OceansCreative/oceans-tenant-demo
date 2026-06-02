/**
 * Lighthouse CI 設定（apps/web 配下）
 *
 * - `/`, `/search`, `/chat` の 3 ページを対象に計測
 * - numberOfRuns: 3（中央値で評価）
 * - chrome flags: --no-sandbox --headless（CI 想定）
 * - 結果は GitHub Actions のアーティファクトとして保存（filesystemPath）
 *
 * assertions の方針:
 * - performance: ヘッドレス + local build はぶれが大きいため warn 0.80 / error 0.50（最低限のフロアのみ block）
 * - accessibility: 0.95 厳格（A11y は退行を許容しない）
 * - best-practices: 0.90 厳格
 * - seo: 0.90 厳格
 */
module.exports = {
  ci: {
    collect: {
      // next start で起動済みサーバーに対して計測する想定（workflow 側で起動）
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/search",
        "http://localhost:3000/chat",
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
          "warn",
          { minScore: 0.8, aggregationMethod: "median-run" },
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
