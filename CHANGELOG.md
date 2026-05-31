# 変更履歴

本プロジェクトのすべての注目すべき変更はこのファイルに記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Added
- スクリーンショット / GIF の正式撮影（docs/images）

## [0.1.2] — 2026-05-31

外部レビュー指摘の medium 3 件をまとめて修正したセキュリティ hardening + UX リリース。

### Security / Hardening

- **#55 SSE エラーメッセージのサニタイズ** (`/api/chat-search`)
  - `sanitizeErrorForClient()` を導入し、SDK 内部メッセージや想定外の例外が SSE 経由でクライアントに露出しないよう定型文に丸める
  - `ANTHROPIC_API_KEY` 未設定のメッセージはホワイトリストで透過（運用者向けに必要）
  - 詳細は `console.error` でサーバー側ログのみに

- **#57 chat-search の Claude 出力を CriteriaSchema で再バリデーション**
  - `packages/shared/src/searchCriteria/schema.ts` を新設し、検索条件の Zod スキーマと `SearchCriteria` 型を統合
  - `/api/query-build` のローカル CriteriaSchema を shared 経由に置換
  - `/api/chat-search` の `parseClaudeCriteriaResponse` で Claude 出力を必ず `searchCriteriaSchema.safeParse()` を通す
  - 失敗時は現状の criteria を維持し、定型文でユーザーに通知
  - 列挙値違反 / 範囲違反 / 不正な ref を後続経路（filter / 将来の GROQ）に到達させない

### Fixed

- **#56 ChatPanel の自動スクロールが新規メッセージで効かない**
  - `useEffect` 依存を `[]` → `[messages.length, pending, results.length]`
  - 新規メッセージ / 結果到着 / pending 切替で末尾に追従

### Changed

- `apps/web/src/lib/search-criteria.ts` は `@oceans-tenant/shared` の `SearchCriteria` 型を re-export
- `package.json` version を 0.1.2 に

### Tests

- shared: 119 → **135**（+16）
- web: 114 → **128**（+14）
- 全 263 ケース pass、CI 全 green

### Docs

- `docs/AI_INTEGRATION.md`: Claude 出力の再バリデーション原則と SSE エラーサニタイズ仕様を追記

## [0.1.1] — 2026-05-31

### Security (Critical)

- **SSRF (Server-Side Request Forgery) を修正** [`#54`](https://github.com/OceansCreative/oceans-tenant-demo/issues/54) — `/api/ingest-url` が任意の URL を `fetch(url, { redirect: "follow" })` していたため、クラウドメタデータ (`169.254.169.254`) / プライベートレンジ / ループバック / リダイレクト経由のバイパスで内部リソースを取得可能だった。
  - 新規 `apps/web/src/lib/ai/url-safety.ts` で `assertPublicIp` / `fetchHtmlSafe` を実装
  - DNS 解決後の IP を IPv4/IPv6 公開レンジ判定（17 拒否レンジ）
  - `redirect: "manual"` で per-hop に URL → DNS → IP を再検証（最大 3 ホップ）
  - レスポンスサイズは Content-Length 早期判定 + ストリーミングで 5MB 上限
  - 500 応答から `details: error.message` を削除し、詳細は `console.error` でサーバー側ログのみ
  - 36 ケースの新規 Vitest テスト（IPv4/IPv6 レンジ / リダイレクトバイパス / サイズ超過 / スキーム拒否）
- `docs/AI_INTEGRATION.md` のエラーハンドリング表に SSRF 関連 6 ステータスを追加、SSRF 防御セクションを新設

### Changed
- `package.json` の version を 0.1.1 に

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
