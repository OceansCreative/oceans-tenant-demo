# 変更履歴

本プロジェクトのすべての注目すべき変更はこのファイルに記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Added
- Sanity 実プロジェクトへの実 PROJECT_ID 投入と動作確認（接続レイヤは v0.4.0 で完成）
- Vercel 実デプロイ + `demo.oceans-base.com/tenant-search` 公開（設定は v0.4.0 で完成）
- TypeScript 6.x 対応
- Upstash Redis 等への in-memory レート制限の置換（本番運用前提）
- `lib/ai/anthropic-client.ts` / `lib/ai/claude-extraction.ts` / `lib/seo/og.tsx` の追加カバレッジ
- WCAG 2.1 AAA（コントラスト 7:1 等）の段階的引き上げ
- Sanity Studio など iframe 埋め込みコンテンツの a11y 保証

## [0.6.0] — 2026-06-03

Phase 6 マイナー継続。`/ship` 並列実装の **5 サイクル目** で、apps/web のカバレッジ底上げ（WS-1）/ Lighthouse Performance 90+ 達成（WS-2）/ axe-core によるアクセシビリティ違反 0 化（WS-3）の 3 ワークストリームを worktree 分離サブエージェントで投入し、OSS リファレンス実装としての "品質磨き込み"（coverage / performance / a11y）を一段引き上げた。

### Added

- **apps/web クライアントコンポーネントの RTL テスト拡充で Lines 70% 突破 (#112)** — `userEvent` ベースで URL クエリ反映・aria 属性・キーボード操作・既存クエリの保持と削除まで網羅
  - **SearchBar / SearchFilter / ViewModeToggle テスト** — URL 同期・aria 属性・キーボード操作・既存クエリ保持を `userEvent` ベースで網羅
  - **IngestForm テスト** — `fetch` をモックし、成功 / API エラー / ネットワーク例外 / 信頼度バーの色帯（emerald / amber / red）/ 送信中ラベルを網羅
  - **PropertyMap テスト** — `@vis.gl/react-google-maps` を軽量スタブに差し替え、API キー有無の分岐とマーカークリックで InfoWindow が開く挙動を検証
  - **ChatPanel SSE 連携テスト** — `ReadableStream` + `TextEncoder` で本物の `Response` を生成し criteria / message / error / done / HTTP エラー / fetch 例外 / 送信中状態を網羅
  - **uuid ユニットテスト** — `crypto.randomUUID` 有り / フォールバック双方の分岐と 10 回連続生成での一意性を検証
- **Lighthouse Performance 90+ を 4 ルートで恒常達成 (#114)** — `next/dynamic` / route 別 `loading.tsx` / `prefetch={false}` / `next.config.ts` 最適化で 4 URL × 3 ラン中央値を 0.96+ に
  - **`PropertyMapLazy`（`next/dynamic`）** — `@vis.gl/react-google-maps` を client 遅延ロード化し `/search` を −13 kB、`/properties/[slug]` を −14 kB 削減
  - **route 別 `loading.tsx`** — `/` / `/search` / `/chat` / `/properties/[slug]` に `aria-busy` 付き skeleton を追加し Streaming で FCP / LCP を底上げ
  - **`Link prefetch={false}`** — Footer / `SearchPagination` / `PropertyCard` で初回 paint 時の RSC ペイロード競合を抑制し TBT を改善（Header のグローバルナビは即タップ確率が高いため `prefetch` を維持）
  - **`next.config.ts` の最適化** — `compress: true` / `images.formats: [avif, webp]` / `optimizePackageImports`（`@vis.gl/react-google-maps` 含む）を投入
  - **テスト追加** — `tests/components/PropertyMapLazy.test.tsx` と `tests/app/loading.test.tsx` で遅延ロード境界とスケルトン描画を保証
- **axe-core 2 層導入で主要 4 ページの a11y 違反を 0 化 (#113)** — `vitest-axe`（ユニット）+ `@axe-core/playwright`（E2E）で WCAG 2.1 AA + best-practice をフルチェック
  - **主要 11 コンポーネントの a11y ユニットテスト** — Header / Footer / PropertyCard / AvailabilityBadge（3 状態）/ SearchPagination / SearchBar / SearchFilter / ViewModeToggle / PropertyMap fallback / IngestForm を `toHaveNoViolations()` で網羅（`tests/a11y/components.test.tsx`、+12 件）
  - **4 ページの a11y E2E スイート** — `/`, `/search`, `/chat`, `/properties/[slug]` を `wcag2a/2aa/21a/21aa/best-practice` で検査し、失敗時は id / impact / help / nodes 数を stderr に出力（`e2e/tests/a11y.spec.ts`、+4 件）
  - **`vitest-axe@0.1.0` ワークアラウンド** — `extend-expect` エントリが空 JS なため `matchers` から直接 `expect.extend` 登録、`declare module "vitest"` で `Assertion` 型を `AxeMatchers` で拡張
  - **アクセシビリティガイドラインの文書化** — `docs/ARCHITECTURE.md` に計測 / 自動化レイヤ表・守っているガイドライン・axe ルール除外方針・AAA 段階引き上げ方針を明文化

### Changed

- `package.json` version を 0.6.0 に
- **Lighthouse CI assertion を厳格化** — `apps/web/.lighthouserc.cjs` の performance を `warn 0.8` → `error 0.9` に引き上げ、計測対象に `/properties/[slug]` を追加し 4 URL 構成へ。median 0.96 で 0.06 の headroom を確保
- **`next/font` 適用の修正** — `globals.css` の `--font-sans` を CSS 変数 `var(--font-noto-sans-jp)` 経由に切り替え self-host フォントを確実に適用
- **`.github/workflows/lighthouse.yml`** — job 名を 4 URL 表記に更新
- **物件詳細の補助カラムを `<aside>` → `<div>` に置換** — `<article>` 配下の `<aside>` は complementary landmark が article 配下となり要件不適合のため、`landmark-complementary-is-top-level` 違反 1 件を解消
- **`apps/web` devDependencies 拡張** — `@axe-core/playwright^4.11.3` / `axe-core^4.12.0` / `vitest-axe^0.1.0` を追加
- **next/navigation モック共通化** — `mockSearchParamsString` を `let` で書き換える方式に統一し URL クエリありの分岐を網羅

### Process

- `/ship` 並列実装の **5 サイクル目**。WS-1 (coverage) / WS-2 (Lighthouse 90+) / WS-3 (a11y) を worktree 分離サブエージェントで同時着手し、PR #112 → #113 → #114 の順に CI green を確認しながらマージ
- v0.6.0 リリースノート生成は Workflow（並列サーベイ 3 agent + 統合 1 agent）で自動化（**3 サイクル目**、v0.4.0 / v0.5.0 で確立したパターンを踏襲）
- 並列開発中は dev server をブラウザ起動したまま 3 worktree を同時編集し、リアルタイムに描画差分・コンソールを目視しながら進行

### Tests

- apps/web vitest: 270 → **364** ケース pass（+94: WS-1 で +69 / WS-3 で a11y +12 / WS-2 で +6 / 微増 +7）
- apps/web カバレッジ: Lines **66.74 → 89.86%（+23.12pt）** / Functions **85.41 → 94.11%（+8.70pt）**
- Playwright: 5 → **9** ケース pass（+4: `/`, `/search`, `/chat`, `/properties/[slug]` の a11y E2E）
- packages/shared 144 / Python pytest / CodeQL / Lighthouse 全 green
- Lighthouse Performance: 4 URL × 3 ラン中央値で **0.96 以上** を確認、assertion は `error 0.9` で CI 強制
- axe 違反: 主要 4 ページで After **全て 0 件**
- Codecov は `informational: true` の warning レベル運用を継続し閾値強制化は別フェーズで段階引き上げ

### Docs

- `docs/ARCHITECTURE.md` に **パフォーマンス計測 / 最適化レイヤ** と **アクセシビリティ計測 / 自動化レイヤ** を追記
  - パフォーマンス: `next/dynamic` 境界 / route 別 `loading.tsx` / `prefetch={false}` ポリシー / Lighthouse assertion `error 0.9` / 4 URL 計測構成を明示
  - a11y: vitest-axe / `@axe-core/playwright` の 2 層・WCAG 2.1 AA + best-practice 対象タグ・守っているガイドライン（ランドマーク / 見出し / フォーム / コントラスト / フォーカス）・axe ルール除外方針・AAA 段階引き上げ方針を明文化

## [0.5.0] — 2026-06-03

Phase 6 マイナー継続。`/ship` 並列実装の **4 サイクル目** で、AI API ルートのレート制限（WS-1）/ SEO ベースライン確立（WS-2）/ vitest カバレッジ計測と Codecov 連携（WS-3）の 3 ワークストリームを worktree 分離サブエージェントで投入し、OSS リファレンス実装としての "公開運用水準" を一段引き上げた。

### Added

- **AI API ルートに in-memory token bucket レート制限を導入 (#109)** — `/api/chat-search` と `/api/ingest-url` を DoS とコスト暴発から守る運用ガードを実装
  - `src/lib/rate-limit.ts` を新規追加。lazy refill / 簡易 LRU evict（MAX 1000 件）/ 環境変数による容量・補充間隔の上書き対応。`nowMs` 注入によりピュア関数寄りでテスト容易な設計
  - `src/lib/get-client-ip.ts` を新規追加。`x-forwarded-for` 最左 → `x-real-ip` → `host` の順で解釈し、IPv6 ブラケットや `IPv4:port` を正規化
  - `/api/chat-search` は既定容量 20 / 6 秒補充（持続 10 req/min）。リクエスト形式検証より先にバケットを消費し、429 は SSE 開始前に通常 JSON `{ error: "rate_limited", retryAfterSeconds }` で返却
  - `/api/ingest-url` は既定容量 10 / 12 秒補充（持続 5 req/min）。AI コスト（HTML 抽出 + Tool Use）が高めなため chat-search より持続レートを半分に抑制
  - 成功・失敗いずれの応答にも `X-RateLimit-Limit/Remaining/Reset` を付与、429 時はさらに `Retry-After` を付加
  - `RATE_LIMIT_CHAT_CAPACITY` / `RATE_LIMIT_CHAT_REFILL_INTERVAL_MS` / 同 `INGEST` 系で運用側から閾値変更可能
- **SEO ベースラインを確立 — JSON-LD / next-og / sitemap / robots (#110)** — 公開検索面の構造化と OG 画像を整備し、Google Rich Results / SNS シェアに耐える状態に
  - schema.org Place の JSON-LD を `buildPropertyJsonLd` で `PropertyWithTsubo` から生成し、`jsonLdPropertySchema`（Zod）で型強制。検証失敗時は `null` を返し `<script>` 出力をスキップする安全側設計
  - `serializeJsonLd` で `<` を Unicode エスケープし、`dangerouslySetInnerHTML` 経由でも `</script>` インジェクションを遮断（OWASP 推奨パターン）
  - 動的 OG 画像 3 ルート（`/og` 汎用 / `/og/search?q=...` 検索キーワード反映 / `/og/property/[slug]` 物件詳細）を `next/og` + edge runtime + Noto Sans JP で実装（1200×630）。Google Fonts 取得失敗時はシステムフォントで描画継続し OG 画像が 500 で落ちない fallback を装備
  - `/sitemap.xml` / `/robots.txt` を整備。静的 3 ページ + mock 物件 5 件を列挙、物件 `lastModified` は `publishedAt` を使用。`/studio` 配下のみ disallow し sitemap URL を host とともに宣言
  - `layout` / トップ / `/search` / `/properties/[slug]` の `generateMetadata` に canonical・`openGraph.images`・`twitter` card を統合
- **vitest にカバレッジレポートを導入し Codecov に連携 (#108)** — テスト品質をワークスペース別の数値で可視化する基盤を整備
  - `codecov.yml` を新規追加し、`project.default: auto` / `patch.default: 70%` / `informational: true` の warning レベル運用を定義
  - `web` / `shared` / `python` の 3 フラグで Codecov にアップロードし、ワークスペース別の粒度で追跡可能に
  - `actions/upload-artifact@v4` で `coverage-reports` を 14 日保管し、PR から lcov / json-summary を確認可能
  - README の CI 行に Codecov バッジを追加し、「カバレッジ」サブセクションで計測対象・除外・目標値を表形式で明示
  - `docs/REVIEW_GUIDE.md` に「カバレッジ運用」セクションを追加し、設定の所在 4 箇所・目標値・初期値・ローカル確認手順・段階的閾値強化のロードマップを記述
  - `apps/web/vitest.config.ts` の reporter に `json-summary` を追加し、将来のスクリプト連携に備える

### Changed

- `package.json` version を 0.5.0 に
- **ingest-url ルートの refactor** — `handleIngestError` がレート残量ヘッダを受け取れるよう変更し、全エラーパス（400/422/502）でも `X-RateLimit-*` を付与
- **availability ステータスマッピング修正** — JSON-LD 出力で enum 値 `closed` に合わせて状態判定を補正
- **`NEXT_PUBLIC_APP_URL` 正規化** — 末尾スラッシュ除去・空文字フォールバック（localhost:3000）を sitemap / robots / 物件詳細で共通化
- **vitest exclude 見直し** — `apps/web` で Server Component 表面（`page.tsx` / `layout.tsx` / `sitemap` / `robots` / `og`）と型定義・テストヘルパを計測対象外に整理
- **閾値運用の方針転換** — `packages/shared` の 80% 強制閾値を削除し、Codecov 側の patch target で段階的に底上げする warning レベル運用に統一
- **Codecov アップロードステップ分割** — 単一ステップで複数 lcov を渡していた構成を、ワークスペース別 3 ステップに分割し `disable_search: true` で二重カウントを防止
- **既存 lint 警告解消** — 不要な `biome-ignore` / optional chain 推奨の警告を整理

### Process

- `/ship` 並列実装の **4 サイクル目**。WS-1 (rate limit) / WS-2 (SEO) / WS-3 (coverage) を worktree 分離サブエージェントで同時着手し、PR #108 → #109 → #110 の順に CI green を確認しながらマージ
- v0.5.0 リリースノート生成は Workflow（並列サーベイ 3 agent + 統合 1 agent）で自動化（**2 サイクル目**、v0.4.0 で確立したパターンを踏襲）

### Tests

- apps/web: 240 → **270** ケース pass（+30: rate-limit 16 / get-client-ip 10 / chat-search・ingest-url の 429 + `X-RateLimit-*` 各 2）
- WS-2 で JSON-LD 8 件 + sitemap 5 件を新規追加（リポジトリ合計 +13）。mock 全件 Zod 通過 / 通貨 JPY / 面積 m² / 実在企業名混入なしを保証
- packages/shared 144 / Python pytest / Playwright 5×2 / CodeQL / Lighthouse 全 green
- 初期カバレッジは apps/web Lines **66.48%** / packages/shared Lines **99.57%**（apps/web は Server Component 表面を Playwright 側でカバーする方針）
- WS-1 の in-memory バケットは `__resetRateLimitForTesting()` を `beforeEach` で呼び、テスト間の状態漏れを防止

### Docs

- `docs/AI_INTEGRATION.md` にレート制限の容量・補充間隔・`X-RateLimit-*` ヘッダ仕様・serverless 環境での Upstash Redis 置換指針を追記
- `docs/ARCHITECTURE.md` に SEO レイヤ（JSON-LD / OG / sitemap / robots）と edge runtime 依存を追記
- `docs/REVIEW_GUIDE.md` に「カバレッジ運用」セクション（設定の所在 4 箇所・目標値・ローカル確認手順・段階的閾値強化のロードマップ）を追加
- `codecov.yml` を新設し、warning レベル運用と将来の閾値強化ステップを設定で明示
- README に Codecov バッジ・カバレッジ表を追加

## [0.4.0] — 2026-06-02

Phase 6 マイナーアップデート。`/ship` 並列実装の 3 サイクル目で、Vercel 実デプロイ準備（WS-1）/ Sanity 実接続レイヤ（WS-2）/ 操作デモ GIF 埋め込み（WS-3）/ README・ARCHITECTURE 整備（WS-4）の 4 ワークストリームを worktree 分離サブエージェントで投入し、OSS リファレンス実装としての "公開水準" を一段引き上げた。

### Added

- **Vercel デプロイ設定と環境変数雛形を整備 (#103)** — monorepo の `apps/web` を繋ぐだけで build / preview / prod できる状態に
  - `vercel.json` に `outputDirectory: apps/web/.next` を追加（`framework: nextjs` / `regions: hnd1` / API Routes の `maxDuration: 60` は既存維持）
  - `.vercelignore` を新設し `apps/studio` / `scripts/python` / `docs/images` / `.claude` / テスト系を除外、ビルドノイズとデプロイサイズを削減
  - `.env.example` をリポジトリ全体 grep ベースで全面拡充。実参照の `process.env.*` を「必須/オプション」「用途」「取得 URL」付きで日本語コメント明記（実値は含めない）
  - `SANITY_API_TOKEN` / `OCEANS_BASEPATH` / Playwright 系変数の用途と最小権限ポリシーを明文化
  - `docs/DEPLOYMENT.md` を新設し、Vercel 初回接続を 7 ステップ + Troubleshooting 6 項目で記述。既存 `DEPLOY.md`（カスタムドメイン・basePath 運用）と役割を明確分離
- **Sanity 実接続レイヤを env 切替で導入 (#104)** — env が揃った瞬間に mock から実 GROQ へ自動で切替わる
  - `@sanity/client@^7.22.1` を `apps/web` に追加（読み取り専用クエリ用途、書き込み系依存は持ち込まない方針）
  - `getSanityClient()`: `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` / `SANITY_API_READ_TOKEN` が揃えば `createClient`（apiVersion 2024-01-01 / useCdn: true）、欠ければ `null` を返す env 切替クライアント
  - `fetchProperties(criteria)`: 一覧と `count(*[...])` を `Promise.all` で並列取得し、`propertySchema.array().safeParse()` 通過時のみ実接続結果を返す。Zod 失敗 / count 不正 / 配列外 / fetch 例外は `console.error` + mock fallback で死活を守る
  - `buildPropertyCountGroq`: 件数取得用 GROQ ビルダを `query-build.ts` に追加。slice 前段の totalCount 取得に利用
  - `buildPropertyGroqFilter` 内部 helper を抽出し、一覧 / 件数クエリ双方で同一フィルタ式を共有（公開 API 挙動は不変）
  - `SANITY_API_READ_TOKEN`（読み取り専用）を `.env.example` に追加し、既存の書き込み用 `SANITY_API_TOKEN` と用途を分離
- **操作デモ GIF 3 本を README に埋め込み (#105)** — スクリーンショット直下に「🎬 操作デモ」セクションを新設
  - `capture-gif.mjs` を新規追加。Playwright で 15fps 操作キャプチャ → ffmpeg の palettegen / paletteuse 2 パスで最適化 GIF を生成（約 500 行、`pnpm screenshots:gif` から実行）
  - `docs/images/demos/` に `search-filter.gif`（213KB）/ `ai-chat.gif`（98KB）/ `url-ingest.gif`（85KB）の計 396KB を追加。検索・対話・URL 取り込みの 3 シーンを a11y 配慮の日本語 alt 付きで埋め込み
  - Playwright の `page.route` で `/api/chat-search` SSE と `/api/ingest-url` JSON をフェイク化し、ANTHROPIC_API_KEY 不要で再現可能な撮影パイプラインに
  - `@ffmpeg-installer/ffmpeg` + `fluent-ffmpeg` + `@types/fluent-ffmpeg` を devDependencies に追加、macOS / Linux で追加セットアップ不要
- **README にバッジ・Quick Start・Architecture を整備 (#106)** — OSS 公開水準の初見可読性を確立
  - バッジ群を 7 個に集約（CI / Lighthouse CI / CodeQL / Release / License (MIT) / Node 20.x / TypeScript strict）を 2 行構成で配置
  - Quick Start セクション新設。`clone → nvm use → corepack → install → .env.local → dev` を 1 コードブロックで完結。ANTHROPIC / Sanity 未設定でも mock fallback で全画面動作する旨を明記
  - Phase 進捗テーブル（Phase 1〜5 完了 / Phase 6 v0.4.0 進行中）と、ドキュメント索引（11 件）を表形式で整理
  - `docs/ARCHITECTURE.md` にレイヤ図とデータフロー 3 ユースケース（検索 / 対話型検索 SSE / URL 取り込み SSRF defense + Tool Use）を ASCII で可視化。Sanity client の env 切替 mock↔GROQ も明示
  - 主要ライブラリ表（14 行）とセキュリティ要点表（SSRF 3 段 / GROQ injection / Claude 出力 / エラー漏洩 / シークレット / 依存脆弱性）を追加

### Changed

- `package.json` version を 0.4.0 に
- `vercel.json` のキー順を整理し、`framework` を上部に移動して設定意図を読みやすく再配置
- README 既存「セットアップ」を Quick Start に昇格し、追加コマンド（studio / screenshots / screenshots:gif）に再編
- `docs/ARCHITECTURE.md` 「セキュリティ」を「セキュリティ運用」に改名し、攻撃面ごとの対策は新設のセキュリティ要点表に分離。本セクションは CodeQL / Dependabot / Lighthouse CI など運用フローに特化
- `docs/REVIEW_GUIDE.md` のリンク整合性を更新（DEPLOYMENT.md / ARCHITECTURE.md / CHANGELOG の参照を v0.4.0 構成に追随）
- `docs/images/README.md` を「スクリーンショット / 操作デモ」へ改題し、GIF 撮影手順・最適化方針・ディレクトリ構成を追記
- `.gitignore` に GIF 撮影の中間 PNG フレーム置き場 `.cache/` を追加

### Process

- `/ship` 並列実装の **3 サイクル目**。WS-1 (Vercel deploy) / WS-2 (Sanity 実接続) / WS-3 (操作デモ GIF) / WS-4 (README + ARCHITECTURE) を worktree 分離サブエージェントで同時着手し、PR #103 → #104 → #105 → #106 の順に CI green を確認しながらマージ
- 4 PR 連続マージで `pnpm-lock.yaml` / `.env.example` / README の rebase 衝突が発生したが、後続 PR で `git checkout --theirs` + `pnpm install` 再生成 + 手動マージで都度解消

### Tests

- apps/web: 205 → **240** ケース pass（+35: WS-2 で client 7 / properties 9 を追加 + WS-1/3/4 関連微増、設定・ドキュメント中心の PR ではテスト追加なし）
- packages/shared 144 / Python pytest / Playwright 5×2 / CodeQL / Lighthouse 全 green
- WS-2 では env 三点切替・条件ドリフト防止・Zod 失敗 / count 不正 / 配列外 / fetch 例外の全 fallback 経路をカバー

### Docs

- `docs/DEPLOYMENT.md` を新設し、Vercel 初回接続フローを 7 ステップ + Troubleshooting 6 項目で完結（既存 `DEPLOY.md` はカスタムドメイン・basePath 運用に責務分離）
- `docs/ARCHITECTURE.md` にレイヤ図 / データフロー 3 ユースケース / 主要ライブラリ表 / セキュリティ要点表を追加
- README に 7 バッジ / Quick Start / Phase 進捗 / ドキュメント索引（11 件） / 操作デモ GIF セクションを追加
- `docs/images/README.md` を「スクリーンショット / 操作デモ」へ改題し撮影手順を追記
- `.env.example` を全面拡充（実参照変数の用途・最小権限ポリシーを日本語コメント明記）

## [0.3.0] — 2026-06-02

Phase 5 マイナー継続。可視性（README スクショ）/ 体感品質（ページネーション）/ 客観計測（Lighthouse CI）の 3 ワークストリームを `/ship` 並列実装で投入し、OSS リファレンス実装としての"見られる状態"を底上げ。

### Added

- **`/search` のページネーション (#101)** — Server Component で `?page=1&pageSize=20` を URL に同期。`searchCriteriaSchema` に `page` (1–10000) / `pageSize` (10–100) を追加し、GROQ projection を `[$offset...$offset + $limit]` に切替
  - `parseSearchCriteria` / `serializeSearchCriteria` で URL ↔ criteria の双方向変換を保証。page=1 / pageSize=20 はデフォルトとして URL から省略（共有リンクを短く保つ）
  - `filter-properties` の戻り値を `Property[]` から `{ items, totalCount }` に変更し、ページ数計算を pure に
  - `SearchPagination` Server Component を新設。AI チャット由来の絞り込みでも URL が走るためページ遷移と整合
  - DoS 防御として page <= 10000 / pageSize <= 100 を Zod で明示（GROQ の `$offset...$offset + $limit` に直接渡る）
  - apps/web vitest +13 ケース（criteria parse / serialize / GROQ offset 導出 / SearchPagination 描画）
- **README にスクリーンショット正式埋め込み (#100)** — `scripts/screenshots/capture.mjs` で Playwright + sharp による撮影パイプラインを整備
  - デスクトップ 6 + モバイル 6 計 12 PNG を `docs/images/{desktop,mobile}/` に commit
  - README の placeholder を Hero 5 セクション + モバイル 1 行に差し替え、初見訪問者が秒で価値を把握できる構成に
- **Lighthouse CI ワークフロー (#99)** — `.github/workflows/lighthouse.yml` 新設。`/`, `/search`, `/chat` の 3 URL を各 3 ラン中央値で計測
  - `@lhci/cli` を導入し `apps/web/.lighthouserc.cjs` で Performance / Accessibility / BestPractices / SEO の閾値を assertions として定義
  - PR ごとにスコアが PR コメントに自動投稿され、ロードマップの "Lighthouse Performance 90+" を CI で機械的に担保
  - 結果アーティファクトを GitHub Actions に保存し、リグレッションの過去比較を可能に

### Changed

- `package.json` version を 0.3.0 に
- README から旧 placeholder を撤去し、撮影済みスクリーンショットの正規パスに差し替え

### Process

- `/ship` 並列実装の 2 サイクル目。WS-1 (pagination) / WS-2 (screenshots) / WS-3 (Lighthouse CI) を worktree 分離サブエージェントで同時着手し、PR #99 → #100 → #101 の順に CI green を確認しながらマージ
- PR #100 で `pnpm-lock.yaml` の競合 (sharp vs @lhci/cli) が発生したが、`git checkout --theirs` + `pnpm install` 再生成で解消

### Tests

- apps/web: 192 → **205** ケース pass（+13: ページネーション関連）
- shared / Python pytest / Playwright / CodeQL / Lighthouse 全 green

### Docs

- README の "Screenshots" セクションを placeholder から実画像 12 枚埋め込みに置換
- CHANGELOG.md に v0.3.0 セクション追加

## [0.2.0] — 2026-06-02

Phase 5 マイナーバージョンアップ。AI レイヤを Tool Use 化、`/studio` を実 NextStudio に、Sanity シードを運用堅牢化、Turbopack 対応の予防策。`/ship` スラッシュコマンドによる worktree 分離サブエージェントの並列実装で 4 ワークストリームをまとめて投入したマイルストーン。

### Added

- **Anthropic Tool Use 移行 (#82 + Tool Use)** — `apps/web/src/lib/ai/tools.ts` 新設、`extract_property` / `update_criteria` の 2 ツールを定義
  - `propertySchema` / `searchCriteriaSchema` を `zod-to-json-schema` で input_schema 化（スキーマ二重管理の解消）
  - `tool_choice: { type: "tool", name }` で構造化応答を強制、`tool_use.input` を必ず `safeParse`
  - 自由テキスト出力のパースぶれを排除
- **NextStudio 埋め込み** — `apps/studio/sanity.config.ts` 新設し、`/studio` を実 Sanity Studio に
  - 環境変数 `NEXT_PUBLIC_SANITY_PROJECT_ID` / `_DATASET` 未設定時は既存のフォールバック UI 維持
  - `next-sanity@^9.12.0` を導入（Next 15 / React 19 / Sanity 3 と整合）
  - workspace 内で React 18 → 19 に統一、sanity 型の二重解決を回避
- **`/ship` スラッシュコマンド** — worktree 分離サブエージェントによる並列実装パターンを v0.1.6 で導入、v0.2.0 でこのコマンド経由で 4 WS を並列投入

### Changed

- **chat-search の abort 伝播 (#82)** — `request.signal` を `client.messages.create(args, { signal })` に伝搬、`ReadableStream.start` 内で `signal.abort` 購読で `controller.close()`。abort 由来例外は SSE error を出さず静かに終了
- **Sanity Python シードクライアント (#66)** — `urllib3.Retry` + `HTTPAdapter` で 429/5xx の exp backoff、`Retry-After` 尊重、タイムアウト `(connect=10, read=60)`、`CHUNK_SIZE=50` で分割
- **Turbopack 対応の予防策 (#65)** — `apps/web/next.config.ts` に `turbopack.resolveExtensions` を追加。webpack 設定は維持し二重化。Turbopack の `resolveAlias` 等価 API は Next.js Issue #82945 で対応中、解決後に webpack 設定削除予定
- `package.json` version を 0.2.0 に

### Tests

- apps/web: 160 → **192** ケース pass（+32: Tool Use 統合 / abort 経路 / tools 単体 / studio 分岐）
- shared 135、Python pytest 61 (+17)、Playwright 5×2 全 pass
- CI 全 green（Lint / typecheck / Vitest / Python / Playwright / CodeQL / 静的解析）

### Docs

- `docs/AI_INTEGRATION.md` を全面的に Tool Use 対応に更新
  - フロー図を `messages.create` テキスト出力 → tool_use ブロックに刷新
  - Zod ⇄ Tool Use の対応表を追加
  - chat-search の abort 伝播経路を 1 セクションで明文化

### Deferred to v0.3.0

- Sanity 実プロジェクト接続（mock 撤去）: 実プロジェクト ID / トークン未提供のため
- Vercel 実デプロイ + DNS: 実 Vercel アカウント未提供のため
- スクリーンショット撮影: 実 Sanity 接続後
- TypeScript 6.x 対応: 主要依存の対応待ち
- 一覧のページネーション: 規模大、別フェーズで独立して扱う
- Lighthouse CI: 実デプロイ後の運用課題

## [0.1.6] — 2026-06-02

UX 改善と並列開発インフラ整備のメンテナンスリリース。Dependabot 8 件 + 開発体験 + UI ライティングをまとめて反映。

### Changed (UI / ライティング)

- **キャッチコピーから専門用語「構造化抽出」を排除し平易な言葉に置換**
  - Hero h1: 「URL を貼るだけで、AI が物件情報を自動で読み取ります」
  - 機能 3 カラム: 「URL → 自動入力」と具体例（住所・賃料・面積）
  - `/agent/ingest` の説明文、IngestForm のヘルプ、metadata description も統一
  - Claude API への system prompt（LLM 向け技術指示）の「構造化抽出エージェント」は維持

### Added (開発体験)

- **git worktree 並列実行のセットアップ**
  - `.worktreeinclude`: 新 worktree に `.env*` を自動コピーするパターンを集約（実値は含まない）
  - `.claude/settings.json`: `worktree.baseRef = "fresh"` / `cleanupPeriodDays = 14`
  - `.claude/commands/ship.md`: ゴールをワークストリームに分解 → worktree 分離サブエージェントで並列実行するスラッシュコマンド
  - `.gitignore` に `.claude/worktrees/` を追加
  - pnpm 9.15.4 は content-addressed store のため worktree との相性が良く、追加ディスクは差分のみ

### Changed (依存更新、Dependabot)

- `@types/node` 20.19.41 → 25.9.1（dev）
- `lint-staged` 17.0.5 → 17.0.7
- `happy-dom` 15.11.7 → 20.9.0（dev、major bump、テスト全 pass で検証）
- `pandas` 2.2.3 → 3.0.3（Python、major bump）
- `pytest` 8.3.3 → 9.0.3（Python、major bump）
- `matplotlib` 3.9.2 → 3.10.9
- `actions/setup-python` 5 → 6
- `pnpm/action-setup` 4 → 6
- `actions/cache` 4 → 5
- `vitest` 2 → 4 はテスト互換性のため close（v0.2.0 で TS 6 と合わせて検討）

### Tests

- shared 135 / web 160 / pytest 40 / Playwright 5 シナリオ × 2 ブラウザ 全 pass
- CI 全 green（Lint / typecheck / Vitest / Python / Playwright / CodeQL / 静的解析）

### Changed (release)

- `package.json` version を 0.1.6 に

## [0.1.5] — 2026-06-01

外部レビュー第 5 弾の指摘 4 件をまとめて修正。v0.1.4 の dead assertion 是正と、v0.2.0「Sanity 実接続」着手前のデータモデル整合化が主軸。

### Fixed

- **#85 url-safety 結合テストの dead assertion を実アサートに置換**
  - v0.1.4 で追加した「lookup が配列形式である」テストは `Symbol.for("undici.agent.options")` が undefined を返すため if ブロックが一度も実行されない空回り状態だった
  - `pinnedLookup(ip): PinnedLookup` を純関数として export し、Agent 内部に依存せず戻り値を直接アサート
  - IPv4 / IPv6 両方で family が正しいことを確認

### Refactor

- **#86 GROQ projection で shared Zod ↔ Sanity の表現差を吸収**
  - shared Zod（web 側）は `aiMeta` ネスト + `*Refs` 文字列形だが、Sanity Studio は `aiExtracted` 等のフラット top-level + reference 形だった
  - v0.2.0「Sanity 実接続」着手時に `propertySchema.parse()` が必ず失敗する遅延地雷
  - GROQ projection を更新: `"suitableBusinessRefs": suitableBusinesses[]._ref` / `"listedByRef": listedBy._ref` / `"aiMeta": { aiExtracted, aiConfidence, sourceUrl }`
  - depositMonths / keyMoneyMonths / floor / previousBusiness / description も projection に追加
  - prompts.test.ts に契約ロックテストを 2 件追加

- **#87 坪数を単一真実化（GROQ から `tsubo` を撤去）**
  - GROQ の `area * 0.3025`（丸めなし）と JS の `squareMeterToTsubo`（小数 2 桁丸め）が食い違っていた
  - `derivePropertyTsubo(property)` をフロントの単一真実として使う方針に統一

### Tests

- **#88 fetchHtmlSafe のリジェクト経路を実 undici 環境で実証**
  - 既存はすべて `fetchImpl` モック注入で、組み立て済み関数が実 undici で一度も走っていなかった
  - node runtime + 実 undici ロード下で 3 ケース追加: private IP / 複数 A レコード混在 / 不正スキーム
  - 成功パスは `assertPublicIp` が 127.0.0.1 を弾く設計上テスト不可能 — その境界を JSDoc に明文化

### Changed

- `apps/web/src/lib/ai/url-safety.ts`: `pinnedLookup` を新規 export、`buildPinnedDispatcher` は組み立てのみに
- `package.json` version を 0.1.5 に
- apps/web: 154 → **160** ケース pass（+6: pinnedLookup 2 / projection 2 / fetchHtmlSafe E2E 3 − dead assertion 1）

## [0.1.4] — 2026-06-01

v0.1.3 で導入した DNS リバインディング遮断が **本番 undici で動作しない** リグレッションを修正。

### Security / Fixed

- **#81 DNS ピン留め lookup を配列形式に修正**
  - v0.1.3 の `buildPinnedDispatcher` は単一形式 `cb(null, ip, family)` を返していたため、Node 20+ の `autoSelectFamily=true` (Happy Eyeballs RFC 8305) と非互換で、実 undici では `ERR_INVALID_IP_ADDRESS` で接続前に弾かれていた
  - 結果として `/api/ingest-url` は常に 500 を返すデッドエンドポイント状態だった（fail-closed のため SSRF 発火ではないが、目玉機能の DNS リバインディング遮断は実証されていなかった）
  - 配列形式 `cb(null, [{ address, family }])` に修正

### Tests

- 実 undici + ローカル HTTP サーバの **結合テスト** 3 件を新設（`url-safety.integration.test.ts`）
  - pinned IP への接続成功 + Host ヘッダー維持
  - 複数 Host への同一 dispatcher 接続
  - lookup コールバックが配列形式であることの直接観測
- 既存 80 ケースの単体テストが全て `fetchImpl` モックで dispatcher 経路を一切実行していなかった構造的な穴を埋める
- apps/web: 151 → **154** ケース pass
- format-only revert で結合テスト 2 件が確実に fail することをローカルで確認（回帰防止の実証）

### Docs

- `docs/AI_INTEGRATION.md` の SSRF 防御セクションに「lookup コールバックの形式（Issue #81）」節を追加

### Changed

- `apps/web/src/lib/ai/url-safety.ts`: `buildPinnedDispatcher` を `export` 化（結合テストから直接呼ぶため）
- `package.json` version を 0.1.4 に

## [0.1.3] — 2026-05-31

外部レビューで指摘された SSRF 対策の残存 2 件をまとめて修正したセキュリティ hardening リリース。

### Security / Hardening

- **#63 DNS リバインディング (TOCTOU) を遮断** (`/api/ingest-url`)
  - v0.1.1 では `assertPublicIp` が検証した IP は捨てられ、続く `fetch` が独立して DNS を引いていた。攻撃者が低 TTL の権威 DNS を握れば「validate 時は public・connect 時は private」と切り替えてバイパス可能だった
  - `undici` の `Agent({ connect: { lookup } })` で検証済み IP を強制注入し、各ホップの fetch を pinned IP に接続
  - HTTPS の SNI / 証明書検証は元の hostname を維持（URL 書き換えなし）
  - Agent はホップごとに close
  - `dns.lookup(host, { all: true })` で全 A/AAAA を取得して全 IP を検査

- **#64 IPv6 アロウリスト化 + 16進 IPv4-mapped 取りこぼし**
  - v0.1.1 の `fc00::/7` 等の blocklist 方式は `::ffff:a9fe:a9fe`（169.254.169.254 の hex 表記）を取りこぼしていた
  - `node:net` の `BlockList` を採用、IPv4 は blocklist、**IPv6 は `2000::/3` allowlist + 内部 block**（`2001:db8::/32`, `2001::/32` Teredo, `2002::/16` 6to4）の二段構え
  - IPv4-mapped IPv6 をドット形式と 16 進形式の両方で IPv4 に展開して再検査
  - IPv4-mapped IPv6 自体は public 値でも一律拒否（攻撃面最小化）

### Changed

- `apps/web` に `undici@^6` を依存追加（Node 20 同梱と整合、jsdom 互換のため v6 固定）
- `package.json` version を 0.1.3 に

### Tests

- apps/web: 128 → **151**（+23: IPv4/IPv6 拒否レンジ網羅、IPv6 hex mapped、複数 A レコード混在、per-hop pinning、DNS rebinding 遮断シナリオ）

### Docs

- `docs/AI_INTEGRATION.md` の SSRF 防御セクションを刷新:
  - IPv6 アロウリスト方式の説明
  - 16 進 IPv4-mapped 対応の明記
  - DNS リバインディング遮断（dispatcher pinning）の項目を新設

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
