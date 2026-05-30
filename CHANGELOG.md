# 変更履歴

本プロジェクトのすべての注目すべき変更はこのファイルに記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Added
- スクリーンショット / GIF の正式撮影（docs/images）

## [0.1.0] — 2026-05-30

OceansTenant 初回リリース。Phase 1〜4 全 32 Issue を完了。

### Added — Phase 1: 基盤構築

- pnpm モノレポ（`apps/web` / `apps/studio` / `packages/shared` / `scripts/python`）
- Biome / Husky / Commitlint / lint-staged による品質ゲート
- GitHub Actions CI（Lint / Typecheck / Vitest / Python pytest）
- E2E（Playwright）/ CodeQL / Dependabot ワークフロー
- Issue / PR テンプレート、CODEOWNERS、CONTRIBUTING、SECURITY、CODE_OF_CONDUCT
- Sanity スキーマ 5 種（property / realEstateCompany / businessCategory / area / searchSession）
- `packages/shared` で Zod ミラーと型を提供（property の `derivePropertyTsubo` 等）
- Python によるダミーデータ seed（東京/大阪/福岡の正規分布配置、宅建業免許形式生成）
- Next.js 15 App Router + Tailwind v4 の基盤と Header / Footer
- 第三者がセットアップ可能な README.md 初版

### Added — Phase 2: 検索体験

- `PropertyCard` / `AvailabilityBadge` / 共通フォーマッタ
- URL 同期 `SearchFilter` / `SearchBar` / `ViewModeToggle`
- `/search` Server Component（フィルタ + 一覧 / 地図切替、ISR 候補）
- `/properties/[slug]` 動的ルート（generateStaticParams + revalidate 60s、OGP）
- Google Maps 地図ビュー（@vis.gl/react-google-maps、API key 未設定時はフォールバック）
- Playwright E2E（Chromium デスクトップ + iPhone 14 の 2 プロジェクト、5 シナリオ）

### Added — Phase 3: AI 機能

- `/api/ingest-url`: URL → Readability → Claude → Zod 検証 → tsubo
- `/api/query-build`: SearchCriteria → GROQ の決定論的変換（ホワイトリスト方式）
- `/api/chat-search`: SSE で criteria / message / results をストリーミング
- `/agent/ingest`: AI 抽出 UI（信頼度バー、抽出結果プレビュー）
- `/chat`: 対話型検索 UI（UUID v4 を URL クエリ、localStorage 禁止）
- Python `analyze_search_logs.py`: pandas + matplotlib で検索ログ集計
- AI プロンプト 13 ケースのスナップショットテスト
- `docs/AI_INTEGRATION.md`: mermaid 図、エラーハンドリング表、Tool Use 想定

### Added — Phase 4: 仕上げと公開

- `/agent` 不動産会社ポータル（自社物件数 / 公開中 / 平均賃料）
- `/agent/properties` 自社物件一覧
- `/studio/[[...tool]]` Sanity Studio 埋め込みプレースホルダー
- `vercel.json`（hnd1 リージョン固定 / セキュリティヘッダ）
- `OCEANS_BASEPATH=/tenant-search` 環境変数で basePath 切替
- `docs/DEPLOY.md`（Vercel 設定 / DNS / 環境変数）
- `docs/ARCHITECTURE.md`（全体図 mermaid / スキーマ ER 図 / レイヤ責務）

### テスト

- Vitest **57** ケース（apps/web + packages/shared）
- pytest **44** ケース（scripts/python、coverage 99%）
- Playwright **5** シナリオ × 2 ブラウザ

### 既知の制約

- 実 AI 抽出 / Sanity / Vercel / Google Maps は環境変数の実キーが必要
- 認証は実装していません（CLAUDE.md 禁止事項）。`/agent` は固定の会社で動作
- スクリーンショット / GIF は v0.1.1 で更新予定
