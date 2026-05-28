# OceansTenant — 店舗物件検索プラットフォーム（公開OSSリファレンス実装）

> **位置づけ**: 店舗物件マッチングプラットフォームのリファレンス実装。AI連携・構造化データ管理・対話型UXを統合した実装パターンとしてOSS公開する。
> **副次目的**: OceansBaseの実装例として営業導線に接続する／開発者個人のFindyスキル偏差値向上に資する公開ポートフォリオとする。
> **公開先**: GitHub公開リポジトリ + `demo.oceans-base.com/tenant-search`
> **想定工数**: 4〜6週間（夜・週末稼働、PR単位での小刻みコミット前提）

---

## 0. プロジェクト前提

- **公開OSSリポジトリ**として開発する（MIT License）
- リポジトリ内に**営業文脈・クライアント情報・実在企業情報は一切含めない**
- READMEは第三者がセットアップして動かせる完成度を持たせる
- ダミーデータ中心、AI機能は実動作
- すべての文言・コメント・コミット・PR・Issueは日本語

## 1. リポジトリ命名と公開戦略

### リポジトリ名
`oceans-tenant-demo` （シンプルかつ検索性のある名前）

### 説明文（GitHub description）
`AI連携を組み込んだ店舗物件検索プラットフォームのリファレンス実装。Next.js 15 / Sanity / Claude API / TypeScript`

### topics（GitHubトピック）
`nextjs` `typescript` `sanity` `claude-api` `headless-cms` `tailwindcss` `ai` `groq` `real-estate` `reference-implementation`

### 公開後の運用（Findy対策の核）

Findyのスキル偏差値はコード品質、GitHubアクティビティ（コミット頻度、IssueやPull Requestでの活動量と質）を主要な評価軸とするため、以下を徹底する。

- **PR駆動開発**: 個人開発でも必ずfeatureブランチ → PR → セルフレビュー → マージの流れを取る
- **コミット粒度**: 1コミット = 1論理単位。`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` のConventional Commits
- **コミット頻度**: 1日1〜数コミットを目標。一気にまとめてpushしない
- **Issue起票**: 着手前にIssueを切り、PR本文で `Closes #N` で紐付け
- **言語の幅**: TypeScript主軸 + Pythonをseed/解析スクリプトに使い、2言語の活動量を稼ぐ
- **テスト同梱**: 機能PRには必ずテストPRも付随
- **READMEバッジ**: CIステータス、ライセンス、Node version、デプロイステータス等を表示

## 2. 採用技術スタック

| 層 | 技術 | バージョン |
|---|---|---|
| フロント | Next.js (App Router) | 15.x |
| 言語（主） | TypeScript | 5.x (strict mode) |
| 言語（補助） | Python | 3.12（seed/解析スクリプト用） |
| スタイル | Tailwind CSS | 4.x |
| UIコンポーネント | shadcn/ui | latest |
| CMS / DB | Sanity | v3 |
| AI | Anthropic Claude API | claude-sonnet-4-5 想定 |
| HTML抽出 | Cheerio / Mozilla Readability | latest |
| 地図 | Google Maps JavaScript API | — |
| ホスティング | Vercel | hnd1 |
| Node | Node.js | 20.x LTS |
| パッケージ | pnpm | 9.x |
| Lint/Format | Biome | latest |
| テスト | Vitest + Testing Library | latest |
| E2E | Playwright | latest |
| CI/CD | GitHub Actions | — |
| 依存更新 | Renovate or Dependabot | — |
| コミット規約 | Commitlint + Husky | — |

## 3. ディレクトリ構成

```
oceans-tenant-demo/
├─ .github/
│  ├─ workflows/
│  │  ├─ ci.yml                      # lint / typecheck / test
│  │  ├─ e2e.yml                     # Playwright
│  │  └─ codeql.yml                  # セキュリティ静的解析
│  ├─ ISSUE_TEMPLATE/
│  │  ├─ bug_report.md
│  │  ├─ feature_request.md
│  │  └─ config.yml
│  ├─ PULL_REQUEST_TEMPLATE.md
│  ├─ CODEOWNERS
│  └─ dependabot.yml
├─ .claude/
│  └─ agents/                        # サブエージェント定義
├─ apps/
│  ├─ web/                           # Next.js 15
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  ├─ components/
│  │  │  ├─ lib/
│  │  │  └─ types/
│  │  ├─ tests/
│  │  │  ├─ unit/
│  │  │  └─ integration/
│  │  └─ package.json
│  └─ studio/                        # Sanity Studio
│     ├─ schemas/
│     └─ package.json
├─ packages/
│  └─ shared/                        # 共有型定義・GROQ
├─ scripts/
│  └─ python/                        # Python補助スクリプト
│     ├─ seed_properties.py          # ダミーデータ生成
│     ├─ analyze_search_logs.py      # 検索ログ分析
│     └─ requirements.txt
├─ e2e/
│  └─ tests/                         # Playwrightテスト
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ DATA_MODEL.md
│  ├─ AI_INTEGRATION.md
│  └─ images/                        # アーキテクチャ図など
├─ .env.example
├─ .gitignore
├─ .nvmrc
├─ biome.json
├─ commitlint.config.js
├─ CHANGELOG.md
├─ CLAUDE.md
├─ CODE_OF_CONDUCT.md
├─ CONTRIBUTING.md
├─ LICENSE                           # MIT
├─ pnpm-workspace.yaml
├─ README.md
└─ SECURITY.md
```

## 4. 必須ファイルの内容

### 4.1 README.md（重要：第三者が読んで完結する）

構成：

```markdown
# OceansTenant

[![CI](https://github.com/USER/oceans-tenant-demo/actions/workflows/ci.yml/badge.svg)](...)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](...)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](...)

AI連携を組み込んだ店舗物件検索プラットフォームのリファレンス実装。
物件URLを入力するとAIが情報を構造化抽出し、自然言語での対話型検索を可能にする。

🔗 **デモ**: https://demo.oceans-base.com/tenant-search

## ✨ 特徴
- 🤖 物件掲載ページのURLからAIが構造化抽出（Claude API + Cheerio）
- 💬 自然言語での対話型物件検索
- 🗺️ Google Maps連携の地図ビュー
- 📦 Sanity headless CMSによる構造化データ管理
- ⚡ Next.js 15 App Router + Server Components
- 🎨 Tailwind CSS + shadcn/ui

## 📸 スクリーンショット
（GIF or 画像3〜4枚）

## 🏗️ アーキテクチャ
（ARCHITECTURE.mdへのリンクと簡易図）

## 🚀 セットアップ
（前提条件、環境変数、起動手順、シードデータ投入）

## 🧪 テスト
（pnpm test, pnpm e2e の説明）

## 📚 ドキュメント
- アーキテクチャ: docs/ARCHITECTURE.md
- データモデル: docs/DATA_MODEL.md
- AI連携設計: docs/AI_INTEGRATION.md

## 🤝 コントリビュート
CONTRIBUTING.md を参照。

## 📄 ライセンス
MIT
```

### 4.2 .env.example

```
# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=your-token

# Anthropic Claude API
ANTHROPIC_API_KEY=your-key
ANTHROPIC_MODEL=claude-sonnet-4-5

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4.3 .gitignore

Next.js / Node / Python / IDE / OS 系を網羅。特に重要:

```
.env
.env.local
.env*.local
node_modules/
.next/
.vercel/
.sanity/
__pycache__/
*.pyc
.venv/
coverage/
playwright-report/
test-results/
```

### 4.4 LICENSE

MIT License（標準テンプレート）。著作権者は `Kazushi Ikeda` または `OceansBase` （後者推奨）。

### 4.5 CONTRIBUTING.md

- 開発環境のセットアップ
- ブランチ戦略（main / feat/*）
- コミット規約（Conventional Commits）
- PRレビューフロー
- テスト要件

### 4.6 SECURITY.md

脆弱性報告先・対応SLA。実運用しないため簡素でよいが、形式として配置する。

### 4.7 CODE_OF_CONDUCT.md

Contributor Covenant v2.1の日本語訳を採用。

## 5. CLAUDE.md（リポジトリルート）

```markdown
# OceansTenant — Claude Code 開発規約

## プロジェクト目的
店舗物件検索プラットフォームのリファレンス実装をOSSとして公開する。
AI連携・構造化データ管理・対話型UXの実装例として参照可能にすることを目的とする。

## 開発原則
1. すべてのコードはTypeScript strict modeに準拠
2. any禁止、unknownで受けて型ガードを書く
3. すべての文言・コメント・コミット・PR・Issueは日本語
4. AI連携部分はAPI Route経由（クライアント直叩き禁止）
5. APIキー・秘密情報は絶対にコミットしない（pre-commitフックで検出）
6. PRには必ず対応テストを含める
7. 機能PRは必ずIssueに紐付ける

## コミット規約
Conventional Commits（日本語可）
- `feat(web): 物件詳細ページを実装`
- `fix(api): URL抽出のタイムアウト処理を修正`
- `test(web): 検索フィルタのユニットテスト追加`
- `docs: アーキテクチャ図を追加`
- `chore(deps): Next.jsを15.1.0に更新`

## ブランチ戦略
- `main`: 常にデプロイ可能
- `feat/<issue-番号>-<概要>`: 機能開発
- `fix/<issue-番号>-<概要>`: バグ修正

## PR規約
- タイトル: Conventional Commits形式
- 本文テンプレートに従う（.github/PULL_REQUEST_TEMPLATE.md）
- 必ず `Closes #N` でIssueを閉じる
- CIグリーン必須

## サブエージェント活用
.claude/agents/ 配下のエージェントを適宜起動する。

## 禁止事項
- localStorage / sessionStorage の使用
- 認証実装（NextAuth等）
- 課金実装
- クライアント情報・営業文脈の記述
- 実在企業名・実在物件情報の混入
```

## 6. Sanityスキーマ設計

`apps/studio/schemas/` 配下に以下を実装。

### 6.1 `property`（物件）

| フィールド | 型 | 必須 | 備考 |
|---|---|---|---|
| `title` | string | ✓ | 物件タイトル |
| `slug` | slug | ✓ | URL用 |
| `address` | object | ✓ | 都道府県/市区町村/番地/緯度経度 |
| `nearestStations` | array of object | | 駅名/路線/徒歩分 |
| `rent` | number | ✓ | 賃料（円/月） |
| `commonFee` | number | | 共益費 |
| `deposit` | number | | 敷金（月数） |
| `keyMoney` | number | | 礼金（月数） |
| `area` | number | ✓ | 専有面積（㎡） |
| `tsubo` | number | ✓ | 坪数（自動換算） |
| `floor` | string | | 階数 |
| `buildingType` | string | | 路面店/ビルイン/居抜き等 |
| `suitableBusinesses` | array of reference | | businessCategory参照 |
| `condition` | string | | スケルトン/居抜き/造作譲渡 |
| `previousBusiness` | string | | 前テナント業種 |
| `images` | array of image | | |
| `description` | text | | |
| `features` | array of string | | 特徴タグ |
| `availability` | string | | 公開中/商談中/成約 |
| `listedBy` | reference | ✓ | realEstateCompany参照 |
| `sourceUrl` | url | | AI抽出元URL |
| `aiExtracted` | boolean | | AI抽出か手動か |
| `aiConfidence` | number | | 抽出信頼度 0-1 |
| `publishedAt` | datetime | ✓ | |

### 6.2 `realEstateCompany`（不動産会社）

`name` / `slug` / `logo` / `description` / `contactEmail` / `licenseNumber` / `representativeName`

※ ダミー会社名のみ。実在企業名は使用しない。

### 6.3 `businessCategory`（業種カテゴリ）

`name` / `slug` / `parent` (self ref) / `icon`

### 6.4 `area`（エリア）

`name` / `prefecture` / `city` / `coordinates` (geopoint)

### 6.5 `searchSession`（検索セッション）

`sessionId` / `messages` / `extractedCriteria` / `resultPropertyIds` / `createdAt`

## 7. 実装フェーズ（Issueとして起票するタスク単位）

各フェーズの開始時にGitHub Issueを起票し、対応PRで `Closes #N` する。

### Phase 1: 基盤構築（Week 1）

Issue #1〜#10程度に分割:

- `chore: モノレポ初期化（pnpm workspace）`
- `chore: Biome / Husky / Commitlint セットアップ`
- `chore: GitHub Actions CI ワークフロー追加`
- `chore: Issue / PRテンプレート整備`
- `feat(studio): Sanityスキーマ - property実装`
- `feat(studio): Sanityスキーマ - realEstateCompany実装`
- `feat(studio): Sanityスキーマ - businessCategory / area実装`
- `feat(scripts): ダミーデータseed Python スクリプト`
- `feat(web): 基本レイアウト・ヘッダー・フッター`
- `docs: README.md 初版`

### Phase 2: 検索体験（Week 2〜3）

- `feat(web): 物件カードコンポーネント` + テスト
- `feat(web): 検索フィルタコンポーネント` + テスト
- `feat(web): 物件一覧ページ`
- `feat(web): Google Maps連携の地図ビュー`
- `feat(web): 物件詳細ページ`
- `feat(web): レスポンシブ対応`
- `test(e2e): 検索フロー Playwrightテスト`

### Phase 3: AI機能（Week 3〜5）

- `feat(api): URL → 構造化抽出 エンドポイント`
- `feat(web): 物件URL投入UI`
- `feat(api): 自然言語 → GROQ生成 エンドポイント`
- `feat(api): 対話型検索 エンドポイント`
- `feat(web): チャット形式の対話型検索UI`
- `feat(scripts): Python による検索ログ分析スクリプト`
- `test(unit): AI連携プロンプトのテスト`
- `docs: AI連携設計ドキュメント`

### Phase 4: 仕上げと公開（Week 5〜6）

- `feat(web): 不動産会社向け管理画面`
- `feat(web): Sanity Studio 埋め込み`
- `chore: Vercelデプロイ設定（hnd1）`
- `chore: demo.oceans-base.com サブドメイン設定`
- `docs: ARCHITECTURE.md 完成`
- `docs: スクリーンショット・GIF撮影`
- `chore: CHANGELOG.md v0.1.0 リリース`

## 8. AI連携API仕様

### 8.1 `POST /api/ingest-url`

**役割**: 物件掲載ページのURLから構造化抽出

**入力**: `{ url: string }`

**処理**:
1. URL先のHTMLをfetch
2. Cheerio + Readabilityで本文抽出
3. Claude APIへ「以下のHTMLから物件情報をJSONスキーマに従って抽出」プロンプト
4. JSON出力をZodで検証
5. Sanityへドラフトとして保存
6. 抽出信頼度・抽出元URLも保存

**出力**: `{ propertyId: string, draft: PropertyDraft, confidence: number }`

### 8.2 `POST /api/chat-search`

**役割**: 対話型検索のターン処理

**入力**: `{ sessionId: string, message: string }`

**処理**:
1. searchSession を取得 or 新規作成
2. Claude APIへ対話 + 構造化抽出（ストリーミング）
3. 条件が揃ったら `query-build` を内部呼び出し
4. GROQ実行 → 結果取得
5. セッションに追記

**出力**: SSEストリーム（aiメッセージ + 部分的な結果カード）

### 8.3 `POST /api/query-build`（内部）

**役割**: 構造化条件 → GROQクエリ生成

**入力**: `{ criteria: SearchCriteria }`

**処理**:
1. Claude APIへ「以下の条件からSanity GROQクエリを生成」
2. ホワイトリスト方式で許可フィールドのみ受け付ける（インジェクション対策）
3. Sanityへ実行

**出力**: `{ groq: string, results: Property[] }`

## 9. テスト戦略

### 9.1 ユニットテスト（Vitest）

- 各コンポーネントのレンダリングテスト
- AI連携プロンプト関数のスナップショットテスト
- ユーティリティ関数のテスト
- Zodスキーマのvalidationテスト
- 目標カバレッジ: 60%以上（main関数・lib配下は80%以上）

### 9.2 統合テスト（Vitest）

- API Routeのテスト（Claude APIはモック）
- Sanityクエリのテスト（モックデータ）

### 9.3 E2E（Playwright）

- ランディング → 検索 → 物件詳細 のクリックパス
- 対話型検索の1往復シナリオ
- 物件URL投入の正常系
- モバイルビューポートでの主要画面表示

### 9.4 CI（GitHub Actions）

`.github/workflows/ci.yml`:

```yaml
on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm biome check .
      - run: pnpm typecheck
      - run: pnpm test --coverage
      - uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

別ワークフロー: `e2e.yml`（Playwright実行）、`codeql.yml`（セキュリティ静的解析）。

### 9.5 Pythonスクリプトのテスト

`scripts/python/tests/` に pytest を配置。requirements.txt に `pytest` を含める。CIでPythonテストも実行。

## 10. Python補助スクリプトの位置づけ

Findyの言語別偏差値でPythonも稼ぐため、以下を意図的にPythonで実装する:

### `scripts/python/seed_properties.py`
- Sanity APIを叩いてダミー物件50件を生成
- 緯度経度はランダムだが東京/大阪/福岡の主要エリアに収まるよう正規分布で生成
- pytest でテストを書く

### `scripts/python/analyze_search_logs.py`
- Sanityから `searchSession` を取得
- pandas で頻出キーワード・検索条件パターンを分析
- matplotlib で可視化（PNG出力）
- これも pytest でテスト

### `scripts/python/extract_from_pdf.py`（任意拡張）
- pypdf + Claude APIでマイソク（PDF）から物件情報抽出
- TypeScript版とは別実装としてPython版も置く（言語の幅アピール）

## 11. UI/UX要件

### デザイン原則
- モバイルファースト
- shadcn/uiベースで一貫性
- 配色は控えめ（OceansBaseに準じた落ち着いたトーン）
- 日本語タイポグラフィ: Noto Sans JP
- 8の倍数スペーシング
- Lighthouse: Performance 90+, Accessibility 95+, Best Practices 95+

### 主要画面

**ランディング (`/`)**
- ヒーロー: 「URLをペーストするだけで物件登録」のAI訴求
- 主要機能の3カラム説明
- デモ動線CTA

**検索 (`/search`)**
- 左サイド: フィルタ
- メイン: カード一覧 ⇄ 地図ビュー切替
- 上部: 自然言語検索バー

**対話型検索 (`/chat`)**
- 左: チャット
- 右: ヒット物件カード（ストリーミング更新）

**物件詳細 (`/properties/[slug]`)**
- 写真ギャラリー、基本情報、地図、適合業種
- 「この物件についてAIに質問」ボタン
- 問い合わせフォームはデモ表示のみ

**不動産会社管理 (`/agent`)**
- URL/PDF投入フォーム
- AI抽出プレビュー → 確認後保存
- 自社物件一覧

## 12. .claude/agents/ サブエージェント定義

各エージェントは YAML frontmatter + Markdown で定義。OceansBase既存パターンに準拠。

- `schema-designer.md` — Sanityスキーマ設計
- `groq-writer.md` — GROQクエリ作成
- `ui-builder.md` — UI実装（Tailwind + shadcn/ui）
- `ai-integrator.md` — Claude API統合
- `test-writer.md` — Vitest / Playwright テスト作成
- `content-editor.md` — UIテキスト推敲

エージェント定義ファイル自体も**公開リポジトリの加点要素**になる（Claude Code活用事例として）ので、丁寧に整備する。

## 13. セキュリティ・運用

- branch protection: mainブランチを保護、PR必須、CIグリーン必須
- secret scanning: GitHub Advanced Security有効化
- Dependabot or Renovate で依存自動更新
- `.env.example` のみコミット、`.env.local` は `.gitignore`
- Claude APIキーはVercel環境変数に保存
- Sanity APIトークンは読み書き別トークンを使用

## 14. 完了基準（v0.1.0リリース定義）

1. mainブランチがCIグリーン状態
2. demo.oceans-base.com でデモが動作
3. README.md だけ読んで第三者がセットアップ可能
4. テストカバレッジ60%以上
5. Lighthouse スコア達成（Performance 90+ / Accessibility 95+）
6. 4種類のAI機能（URL抽出、対話型検索、GROQ生成、物件Q&A）が動作
7. Issue/PRの履歴が機能ごとに分かれて残っている
8. CHANGELOG.md に v0.1.0 が記載されている
9. GitHub Releaseタグ `v0.1.0` が作成されている

## 15. 公開後の継続運用

完了後も以下を続けることでFindyスキル偏差値の維持・向上に寄与:

- 月1〜2回の機能追加PR
- 依存パッケージ更新PRのレビュー・マージ
- READMEや docs/ の継続的な改善
- Issueでの機能アイデアログ
- v0.2.0, v0.3.0 のマイルストーン設計

---

## Claude Code への初回プロンプト例

```
このリポジトリは公開OSS「OceansTenant」です。
docs/spec.md（本ファイル）と CLAUDE.md を読み込み、開発規約を理解してください。

まず Phase 1 の Issue を docs/spec.md に従って10件程度起票してください。
各Issueには概要・受け入れ条件・関連ドキュメントを含めてください。

Issue起票後、最初のIssue「chore: モノレポ初期化」から着手し、
featureブランチを切ってPR形式で実装を進めてください。
各PRは小さく、テストを含む形で出してください。

私はセルフレビュー後にマージします。
```

## 付録: Findy スキル偏差値を上げる実装プラクティス

| プラクティス | 効果 |
|---|---|
| TypeScript strict mode | コード品質スコア向上 |
| テストカバレッジ60%+ | 品質指標向上 |
| Python補助スクリプト追加 | 言語別偏差値の幅増加 |
| 小さくこまめなPR | アクティビティ評価向上 |
| Conventional Commits | コミットメッセージの質評価 |
| Issue/PR の丁寧な記述 | 活動の質評価 |
| READMEの充実 | リポジトリ充実度 |
| CIグリーン維持 | 品質シグナル |
| GitHub Releaseタグ | プロジェクトの完成度シグナル |
| 月次更新の継続 | アクティビティ継続性 |
