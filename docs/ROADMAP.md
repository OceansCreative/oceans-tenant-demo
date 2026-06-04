# Roadmap

OceansTenant は **AI 連携・構造化データ管理・対話型 UX を統合した OSS リファレンス実装** です。
本ドキュメントでは v1.0.0 までのマイルストーン、これまでの達成事項、今後の構想を整理します。

リリース履歴の詳細は [CHANGELOG.md](../CHANGELOG.md) を、メジャーアップグレード時の互換性ガイドは
[docs/MIGRATION.md](./MIGRATION.md) を参照してください。

---

## 1. v1.0.0 マイルストーン

v1.0.0 は **「公開リファレンス実装としての完成」** を意味します。具体的には以下の条件をすべて満たすことを目標とします。

- **OSS としての公開水準**: README / ARCHITECTURE / AI_INTEGRATION / REVIEW_GUIDE / DEPLOYMENT / ROADMAP / MIGRATION / SECURITY / CONTRIBUTING / CODE_OF_CONDUCT が揃い、第三者が `pnpm install && pnpm dev` で動かせる
- **AI 連携の実動作**: `extract_property` / `chat-search` / `query-build` の 3 経路が Anthropic Claude API + Sanity 実接続で end-to-end に通る
- **品質の自動可視化**: CI で lint / typecheck / vitest / Playwright / CodeQL / Lighthouse / Chromatic / Codecov / eval ハーネスが常時実行され、しきい値を下回ると検知できる
- **国際化**: ja / en の 2 言語で UI が完全に切り替わり、SEO メタデータも locale 同期する
- **a11y / Performance**: 主要ページで axe 違反 0、Lighthouse Performance / Accessibility / Best Practices / SEO がすべて 90+
- **デプロイ**: Vercel 本番で `demo.oceans-base.com/tenant-search` が公開され、`OCEANS_BASEPATH` 切替が動作する

リファレンス実装としての性質上、**本番ワークロードを支える運用機能（認証 / 課金 / 監視 SaaS 連携）は v1.0.0 のスコープ外** とします。
このスコープ境界は本ドキュメントの「5. v1.x 以降の構想（OSS スコープ外）」で改めて明示します。

---

## 2. Done — v0.1.0 → v0.9.0

各バージョンのハイライトを 1 行ずつ列挙します。詳細は [CHANGELOG.md](../CHANGELOG.md) を参照。

| バージョン | リリース日 | ハイライト |
|---|---|---|
| v0.1.0 | 2026-05-30 | 初回公開。Phase 1〜4 の基盤・検索・AI・仕上げを一括投入（モノレポ / Sanity スキーマ 5 種 / `/search` `/chat` `/agent` / Playwright E2E / `vercel.json`） |
| v0.1.1〜v0.1.6 | 2026-05-31 〜 06-02 | SSRF 多層防御 / Tool Use 移行 / NextStudio 埋込 / 開発体験改善 |
| v0.2.0 | 2026-06-02 | ページネーション / Lighthouse CI / スクリーンショット自動撮影 |
| v0.3.0 | 2026-06-02 | docs/ARCHITECTURE.md と docs/AI_INTEGRATION.md を整備、可視化と README 仕上げ |
| v0.4.0 | 2026-06-02 | Sanity 実接続レイヤ / `OCEANS_BASEPATH` / DEPLOYMENT.md / GIF 操作デモの整備 |
| v0.5.0 | 2026-06-03 | `/ship` 並列実装 4 サイクル目。型分岐の堅牢化・地図・OG・カバレッジ底上げ |
| v0.6.0 | 2026-06-03 | カバレッジ 95.84% / Lighthouse Performance 90+ / axe 違反 0 を確立 |
| v0.7.0 | 2026-06-03 | Storybook 8 + Chromatic 視覚回帰 / 関連物件 / FilterChips / マーカークラスタリング / AI 連携 100% カバレッジ |
| v0.8.0 | 2026-06-03 | `next-intl` フェーズ 1（Header / Footer / Hero）/ AI 抽出評価ハーネス / Storybook Foundation MDX |
| v0.9.0 | 2026-06-03 | i18n フェーズ 2（全画面翻訳化）/ eval CI 統合（PR ラベル + 週次 cron）/ `/insights` 物件統計ダッシュボード |

**累積成果（v0.9.0 時点）**:

- apps/web vitest: **470 ケース**、packages/shared **144 ケース**、`oceans-tenant-eval` node:test **29 ケース**
- Playwright E2E: **22 ケース**（locale 強制 + `/insights` a11y）
- apps/web カバレッジ Lines: **95.84%**
- Lighthouse: 5 URL × 3 ラン中央値で全 **0.96+**
- a11y: 主要 5 ページで違反 **0**
- `/ship` 並列実装: **8 サイクル**実施
- Workflow（リリースノート生成）: **3 サイクル**実施

---

## 3. v1.0.0 までの残作業

[CHANGELOG.md](../CHANGELOG.md) の `[Unreleased]` から、v1.0.0 で完了させたい項目を抽出します。
各項目は Issue → ブランチ → PR で進める予定です。

### 必須（Must）

- **Sanity 実 PROJECT_ID 投入** — 接続レイヤは v0.4.0 で完成済み。実プロジェクト ID と `production` データセットを env に投入し、ダミー 50 件を seed して end-to-end で動作確認する
- **Vercel 実デプロイ** — `demo.oceans-base.com/tenant-search` を公開し、`OCEANS_BASEPATH` 切替を本番で検証する。デプロイ手順は [docs/DEPLOYMENT.md](./DEPLOYMENT.md) / [docs/DEPLOY.md](./DEPLOY.md) に従う
- **v1.0.0 リリースノート** — `[Unreleased]` から該当項目を移し、Migration の影響を [docs/MIGRATION.md](./MIGRATION.md) に追記

### 推奨（Should）

- **TypeScript 6.x 対応** — Next.js 15 / Sanity v3 / vitest の 6.x 互換確認、`tsconfig.json` の `moduleResolution: "bundler"` の挙動確認
- **Upstash Redis 等への in-memory レート制限の置換** — 本番運用前提では in-memory ではサーバレス各インスタンスで独立してしまうため
- **WCAG 2.1 AAA**（コントラスト 7:1 等）の段階的引き上げ
- **Sanity Studio など iframe 埋め込みコンテンツの a11y 保証** — `/studio` 配下は現状 axe 対象外
- **Storybook の `globalTypes` による ja / en 切替**（v0.9.1 候補）

### 任意（Nice to have）

- **Sanity 多言語スキーマ案** — 建物種別ラベル等の locale 切替を Sanity 側でも完結させる（現状は client 側 enum helper で代替）
- **Web Vitals 永続化** — 現状は in-memory store でサーバレス各インスタンスに散る。Vercel KV 等への置換
- **Issue / PR の `good first issue` ラベル整備** — 初学者が手をつけやすい単位の Issue を 5〜10 件常時用意

---

## 4. コミュニティ参加

OceansTenant は OSS リファレンス実装であり、Issue / Pull Request を歓迎します。

### 歓迎する貢献

- バグ報告（[.github/ISSUE_TEMPLATE/bug_report.yml](../.github/ISSUE_TEMPLATE/bug_report.yml)）
- 機能要望（[.github/ISSUE_TEMPLATE/feature_request.yml](../.github/ISSUE_TEMPLATE/feature_request.yml)）
- ドキュメント改善（typo / 説明不足 / リンク切れ）
- テスト追加（既存実装に対するエッジケース網羅）
- パフォーマンス / a11y 改善（Lighthouse / axe の警告解消）
- 翻訳キーの追加と en 翻訳の改善

### ラベル運用

- `good first issue` — 初学者向け。1 ファイル〜数ファイル規模、テスト同梱でクローズ可能なもの
- `help wanted` — 設計判断が必要だが歓迎する Issue
- `eval` — PR に付与すると AI 抽出評価ハーネスが Anthropic API で本実行され PR コメントに結果が投稿される（v0.9.0 で導入）
- `dependencies` — Dependabot 自動 PR
- `priority:high` — v1.0.0 のクリティカルパス

詳細な貢献フローは [CONTRIBUTING.md](../CONTRIBUTING.md) を参照してください。

---

## 5. v1.x 以降の構想（OSS スコープ外）

リファレンス実装の境界を保つため、以下は **本リポジトリのスコープ外** とします。
これらは [CLAUDE.md](../CLAUDE.md) の禁止事項とも整合しています。

| 領域 | 理由 | 代替の参照先 |
|---|---|---|
| 認証 / 認可（NextAuth, Clerk, Auth0 等） | 「認証実装は禁止」（CLAUDE.md）。AI 連携のリファレンス実装にスコープを絞るため | 各認証 SaaS のドキュメント |
| 課金 / サブスクリプション（Stripe 等） | 「課金実装は禁止」（CLAUDE.md）。営業文脈・実プロダクト要件を混ぜないため | Stripe 公式サンプル |
| マルチテナント / 組織管理 | 認証前提の機能のため | — |
| 営業文脈 / 実在企業情報 / 実在物件情報 | リファレンス実装に営業文脈を混ぜない方針 | — |
| Sanity 以外の CMS 抽象化 | リファレンス実装としてのシンプルさを保つため。Sanity を 1 つの実装例として位置付ける | Headless CMS 各社のドキュメント |
| 本番運用向け監視 SaaS（Datadog / Sentry 等）の常時連携 | 鍵管理と運用コストが OSS スコープを超えるため | Vercel Observability / 各 SaaS の Next.js 統合ガイド |
| モバイルアプリ（React Native 等） | Web App Router のリファレンスにスコープを絞るため | — |

これらの組み込みを希望する場合は、本リポジトリを fork して各自のニーズに合わせて拡張してください。
本リポジトリはあくまで **「AI 連携と構造化データ管理の参照点」** に徹します。

---

## 6. ステータス確認

- 各リリースの詳細: [CHANGELOG.md](../CHANGELOG.md)
- 互換性ガイド: [docs/MIGRATION.md](./MIGRATION.md)
- 仕様書: [docs/spec.md](./spec.md)
- アーキテクチャ: [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- AI 連携詳細: [docs/AI_INTEGRATION.md](./AI_INTEGRATION.md)
