# 変更履歴

本プロジェクトのすべての注目すべき変更はこのファイルに記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Added
- Sanity 実プロジェクトへの GROQ 接続（mock 撤去）
- Vercel 実デプロイ + `demo.oceans-base.com/tenant-search` 公開
- TypeScript 6.x 対応
- GIF 形式の操作デモ追加

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
