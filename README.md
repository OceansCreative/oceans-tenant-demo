<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# 🏪 OceansTenant

**AI 連携を組み込んだ店舗物件検索プラットフォームのリファレンス実装**

[![CI](https://github.com/OceansCreative/oceans-tenant-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/OceansCreative/oceans-tenant-demo/actions/workflows/ci.yml)
[![CodeQL](https://github.com/OceansCreative/oceans-tenant-demo/actions/workflows/codeql.yml/badge.svg)](https://github.com/OceansCreative/oceans-tenant-demo/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Sanity](https://img.shields.io/badge/Sanity-v3-F03E2F?logo=sanity&logoColor=white)](https://www.sanity.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

</div>

物件 URL をペーストするだけで AI が情報を構造化抽出し、自然言語での対話型検索を可能にする
OSS リファレンス実装です。Next.js 15 / Sanity v3 / Anthropic Claude API / Tailwind CSS 4 で構成されています。

🔗 **デモ**: [demo.oceans-base.com/tenant-search](https://demo.oceans-base.com/tenant-search)

---

## ✨ 特徴

- 🤖 **URL → 構造化抽出** — 物件掲載ページの URL を投げると、Cheerio + Mozilla Readability で本文抽出 → Claude API で JSON スキーマ抽出 → Zod 検証 → Sanity にドラフト保存
- 💬 **対話型検索** — 自然言語の条件から Claude が GROQ クエリを生成し、ホワイトリスト方式でインジェクション対策しながら Sanity を検索
- 🗺️ **地図ビュー** — Google Maps JavaScript API で物件をマップ表示、カード ⇄ 地図のビュー切替
- 📦 **Sanity Headless CMS** — Property / RealEstateCompany / BusinessCategory / Area / SearchSession の 5 ドキュメントタイプを Zod スキーマと 1:1 で運用
- ⚡ **Next.js 15 App Router** — Server Components / SSE ストリーミング / TypedRoutes
- 🎨 **Tailwind CSS v4** — oklch カラートークン / Noto Sans JP / モバイルファースト / a11y 配慮
- 🐍 **Python 補助** — pydantic + faker でダミー物件 50 件を生成し Sanity にシード

## 📸 スクリーンショット

<sub>Mock データのみ使用（実在企業・実在物件は含みません）。再生成は `pnpm screenshots`。</sub>

### ランディング

![ランディングページのスクリーンショット（OceansTenant のヒーローセクションと特徴カード）](docs/images/desktop/landing.png)

### 物件を探す（検索一覧）

![検索一覧ページのスクリーンショット（フィルタとカード一覧）](docs/images/desktop/search.png)

### 物件詳細

![物件詳細ページのスクリーンショット（基本情報・最寄り駅・地図フォールバック）](docs/images/desktop/property-detail.png)

### 対話型検索

![対話型検索画面のスクリーンショット（自然言語入力と抽出条件 JSON プレビュー）](docs/images/desktop/chat.png)

### 不動産会社ポータル

| ダッシュボード | URL 取り込み |
|---|---|
| ![不動産会社ダッシュボードのスクリーンショット（自社物件数・公開数・平均賃料）](docs/images/desktop/agent.png) | ![URL 取り込み画面のスクリーンショット（URL 入力フォーム）](docs/images/desktop/agent-ingest.png) |

### モバイル表示

| ランディング | 検索 | 対話 |
|---|---|---|
| ![モバイル版ランディング](docs/images/mobile/landing.png) | ![モバイル版検索](docs/images/mobile/search.png) | ![モバイル版対話型検索](docs/images/mobile/chat.png) |

## 🏗️ アーキテクチャ

```text
              ┌──────────────────────────────────┐
              │  Next.js 15 App Router (Vercel) │
              │  ├─ /search    一覧 + 地図        │
              │  ├─ /chat      対話型検索 (SSE)    │
              │  ├─ /properties/[slug]            │
              │  ├─ /agent     不動産会社管理        │
              │  ├─ /studio    Sanity Studio 埋込み │
              │  └─ /api/*     API Routes         │
              └────┬───────────┬──────────┬──────┘
                   │           │          │
       Claude API ─┘     Sanity v3      Google Maps
       (構造化抽出 /     (Document /     (JS API)
        対話 / GROQ)      Reference /
                          GROQ)
```

詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照。

## 🚀 セットアップ

### 前提条件

| ツール | バージョン |
|---|---|
| Node.js | 20.x LTS（`.nvmrc` で固定） |
| pnpm | 9.15.4（`packageManager` で固定） |
| Python | 3.12（`scripts/python/` でのみ使用） |

### 手順

```bash
# クローンと依存関係インストール
git clone https://github.com/OceansCreative/oceans-tenant-demo.git
cd oceans-tenant-demo
corepack prepare pnpm@9.15.4 --activate
pnpm install

# 環境変数の準備
cp .env.example .env.local
# .env.local を編集して Sanity / Anthropic / Google Maps の各キーを設定

# 開発サーバー起動
pnpm dev              # Next.js (apps/web)
pnpm studio           # Sanity Studio (apps/studio)
```

### 環境変数

| 変数 | 必須 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | ✅ | Sanity プロジェクト ID |
| `NEXT_PUBLIC_SANITY_DATASET` | ✅ | Sanity データセット（`production`） |
| `SANITY_API_TOKEN` | ✅ | 書き込みトークン |
| `ANTHROPIC_API_KEY` | ✅ | Claude API キー |
| `ANTHROPIC_MODEL` | — | 既定 `claude-sonnet-4-5` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | — | 未設定時は地図ビューを無効化 |
| `NEXT_PUBLIC_APP_URL` | — | OGP / canonical 用 |

### ダミーデータの投入

```bash
cd scripts/python
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt 'pydantic[email]'
.venv/bin/python seed_properties.py --count 50            # Sanity に 50 件投入
.venv/bin/python seed_properties.py --count 50 --dry-run  # 確認のみ
```

## 🧪 テスト

```bash
pnpm lint            # Biome
pnpm typecheck       # tsc --noEmit（全ワークスペース）
pnpm test            # Vitest（全ワークスペース）
pnpm test:coverage   # カバレッジ付き

# E2E（Playwright、Phase 2 で導入）
pnpm --filter @oceans-tenant/web exec playwright test

# Python
cd scripts/python && .venv/bin/pytest --cov
```

CI（GitHub Actions）で以下が常時走ります:

- `ci.yml`: Lint / 型 / ユニットテスト / Python pytest
- `e2e.yml`: Playwright
- `codeql.yml`: JS/TS 静的解析

## 🗂️ ディレクトリ構成

```text
oceans-tenant-demo/
├─ apps/
│  ├─ web/                # Next.js 15 App Router
│  └─ studio/             # Sanity Studio v3
├─ packages/
│  └─ shared/             # Zod スキーマ / 型 / GROQ
├─ scripts/
│  └─ python/             # Sanity シード + ログ分析
├─ e2e/                   # Playwright（Phase 2 で導入）
├─ docs/
│  ├─ spec.md             # 仕様書
│  ├─ ARCHITECTURE.md
│  ├─ AI_INTEGRATION.md
│  └─ images/             # スクリーンショット
└─ .github/               # workflows / templates
```

## 📚 ドキュメント

- 📐 [アーキテクチャ](docs/ARCHITECTURE.md)
- 🤖 [AI 連携設計](docs/AI_INTEGRATION.md)
- 📜 [仕様書](docs/spec.md)
- 🚀 [デプロイ手順](docs/DEPLOY.md)
- 🧐 [レビューガイド](docs/REVIEW_GUIDE.md)（コードレビュー入口）
- 🛠 [コントリビュート](CONTRIBUTING.md)
- 🔐 [セキュリティ](SECURITY.md)
- 🤝 [行動規範](CODE_OF_CONDUCT.md)
- 🤖 [Claude Code 開発規約](CLAUDE.md)

## 🤝 コントリビュート

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。Issue とプルリクエストを歓迎します。

## 📄 ライセンス

MIT License © 2026 OceansBase — [LICENSE](LICENSE) 全文

---

<div align="center">

リファレンス実装としての完成度を保つため、本リポジトリには<br />
クライアント情報・営業文脈・実在企業名・実在物件情報は含まれていません。

</div>
