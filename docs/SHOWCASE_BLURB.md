# Showcase Blurb — OceansTenant

`oceans-base.com` の親ページ（紹介サイト）に掲載するための、OceansTenant 紹介テキスト
草案です。掲載枠に応じて **短文 / 標準 / 詳細** の 3 トーンを用意しています。

- **Demo**: <https://demo.oceans-base.com/tenant-search>（v1.0.0 公開予定）
- **GitHub**: <https://github.com/OceansCreative/oceans-tenant-demo>
- **License**: MIT © 2026 OceansBase

各トーンとも、必要に応じて見出しレベルを調整して親サイトの CMS に貼り付けてください。

---

## トーン A — 短文（1〜2 段落、カード掲載向け）

**OceansTenant** は、AI 連携・構造化データ管理・対話型 UX を 1 つのアプリケーションに
統合した、店舗物件検索プラットフォームの OSS リファレンス実装です。物件 URL を貼ると
Claude が情報を構造化抽出し、自然言語の対話で物件を絞り込めます。

Next.js 15 / Sanity v3 / Anthropic Claude API / Tailwind CSS 4 で構成。MIT ライセンス
下で fork / 改変が自由です。

- **Demo**: [demo.oceans-base.com/tenant-search](https://demo.oceans-base.com/tenant-search)
- **Source**: [github.com/OceansCreative/oceans-tenant-demo](https://github.com/OceansCreative/oceans-tenant-demo)

---

## トーン B — 標準（事例ページ本文、約 400 字）

### OceansTenant とは

**店舗物件検索プラットフォームの OSS リファレンス実装**です。AI による URL からの
構造化抽出、自然言語での対話型検索、Sanity 連携、地図ビュー、ja / en の 2 言語切替を、
1 つの Next.js アプリケーションに統合しています。

### 技術スタック

- **フロント**: Next.js 15（App Router）/ TypeScript（strict mode）/ Tailwind CSS 4
- **CMS**: Sanity v3（Studio 埋め込み / GROQ クエリ）
- **AI**: Anthropic Claude API（Tool Use / SSE ストリーミング）
- **i18n**: `next-intl`（cookie ベース、ja / en）
- **テスト**: Vitest / Playwright / axe / Lighthouse CI / Chromatic
- **CI**: GitHub Actions（lint / typecheck / e2e / CodeQL / Codecov / 評価ハーネス）

### 見どころ

- **URL → 構造化抽出**: Cheerio + Mozilla Readability で本文抽出 → Claude API で JSON
  スキーマ抽出 → Zod 検証 → Sanity にドラフト保存
- **対話型検索 (SSE)**: 自然文から Claude が GROQ クエリを生成、ホワイトリスト方式で
  インジェクション対策
- **AI 抽出評価ハーネス**: Gold Standard 5 件 × フィールド別精度メトリクスを CI に統合し、
  PR ラベルで本実行 / 週次 cron で常時測定
- **品質ゲート**: Lighthouse 全カテゴリ 90+ / axe 違反 0 / カバレッジ 95.84%（Lines）
- **i18n**: cookie ベース locale 切替で `localStorage` 不使用、SEO メタデータも同期

### 試す

- **Live Demo**: <https://demo.oceans-base.com/tenant-search>
- **GitHub**: <https://github.com/OceansCreative/oceans-tenant-demo> — fork / Issue / PR を歓迎

### ライセンス

MIT License © 2026 OceansBase

---

## トーン C — 詳細（技術ブログ / 事例詳細ページ向け、約 900 字）

### OceansTenant — 店舗物件検索の OSS リファレンス実装

OceansTenant は、店舗物件検索の AI 統合プラットフォームを **「動くリファレンス実装」**
として OSS 公開しているプロジェクトです。実プロダクトの営業文脈・実在企業・実在物件は
一切含まず、純粋に **AI 連携と構造化データ管理の参照点** として機能することを目的に
しています。

### このリファレンス実装で得られるもの

- Anthropic Claude API（Tool Use / SSE ストリーミング）を Next.js App Router の API
  Route に組み込む実装パターン
- 物件掲載 URL から構造化データへ落とすパイプライン（Cheerio + Mozilla Readability +
  Claude + Zod + Sanity ドラフト）
- 自然言語 → GROQ クエリ生成のホワイトリスト型インジェクション対策
- AI 抽出精度を継続測定する評価ハーネスと CI 統合
- ja / en の 2 言語切替（cookie ベース、`localStorage` 不使用）
- Sanity v3（Document / Reference / GROQ）と Next.js Server Component の組み合わせ
- Vercel デプロイと `OCEANS_BASEPATH` を利用した `/tenant-search` 配下ホスティング

### 技術スタック

| 領域 | 採用技術 |
|---|---|
| フロント | Next.js 15 App Router / TypeScript strict / Tailwind CSS 4 |
| CMS | Sanity v3（Studio 埋め込み / Desk Structure / GROQ） |
| AI | Anthropic Claude API（Tool Use / SSE） |
| i18n | `next-intl`（cookie ベース、ja / en） |
| 地図 | Google Maps JavaScript API + `@googlemaps/markerclusterer` |
| テスト | Vitest / Playwright / axe / Lighthouse CI / Chromatic |
| CI | GitHub Actions（lint / typecheck / e2e / CodeQL / Codecov / eval） |
| シード | Python 3.12 + pydantic + faker |

### 品質ゲート

- vitest（apps/web）**480+ ケース** / packages/shared **144 ケース**
- Playwright E2E **22 ケース**（locale 強制 + `/insights` a11y 含む）
- apps/web カバレッジ Lines **95.84%**
- Lighthouse（5 URL × 3 ラン中央値）**全カテゴリ 0.96+**
- axe 違反（主要 5 ページ）**0**

### 試す

- **Live Demo**: <https://demo.oceans-base.com/tenant-search>
- **GitHub**: <https://github.com/OceansCreative/oceans-tenant-demo>
- **fork 歓迎**: 自社プロジェクトの土台として自由に改変可能（MIT ライセンス）

### このリファレンス実装の活用方法

`README.md` の Quick Start に従って `pnpm install && pnpm dev` するだけで、Mock データ
での動作確認まで到達します。Sanity プロジェクトと Anthropic API キーを `.env.local` に
入れれば、AI 連携と Sanity GROQ 経路が有効化されます。

本番に近い形で動かしたい場合は [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) の
「ユーザー作業 30 分セットアップ」セクションに従うと、Vercel に独自ドメインで公開できる
ところまで 30〜40 分で到達します。

### ライセンス

MIT License © 2026 OceansBase
