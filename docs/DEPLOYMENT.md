# Vercel デプロイ手順（接続するだけで動かす）

OceansTenant の `apps/web`（Next.js 15 App Router）を Vercel にデプロイするための、
step-by-step 手順です。「Vercel に Git リポジトリを繋いで環境変数を入れるだけ」で
preview / production デプロイが通る状態になることを目標としています。

カスタムドメインや `/tenant-search` basePath などのアプリ固有のデプロイ運用は
[`docs/DEPLOY.md`](./DEPLOY.md) を参照してください。本ドキュメントは「初回接続」
にスコープを絞ります。

## 前提

- Vercel アカウントが作成済みであること（個人プランで可）
- GitHub の本リポジトリへのアクセス権があること
- Sanity プロジェクトと Anthropic API キーが用意できること（後述）

## 1. リポジトリを Vercel に Import

1. [Vercel ダッシュボード](https://vercel.com/new) を開く
2. **Add New... → Project** から GitHub 連携で `oceans-tenant-demo` を選択
3. Framework Preset は **Next.js**（自動検出される）

## 2. Root Directory の指定

- **Root Directory はリポジトリのルート（`./`）のままにする**
- monorepo だが、`vercel.json` の `buildCommand` / `outputDirectory` で
  `apps/web` をビルドするよう構成済みのため、Root を `apps/web` に変える必要は
  ない（むしろ変えると `pnpm install` のワークスペース解決が壊れる）

## 3. Build & Output Settings の確認

`vercel.json` で以下を固定しているため、UI 側は**いずれも空欄のまま**で良い:

| 項目 | 値（vercel.json で指定済み） |
|---|---|
| Build Command | `pnpm --filter @oceans-tenant/web build` |
| Install Command | `pnpm install --frozen-lockfile` |
| Output Directory | `apps/web/.next` |
| Node.js Version | `20.x`（`.nvmrc` の `20` から自動検出） |
| Region | `hnd1`（東京） |

UI で上書きすると `vercel.json` の指定と二重管理になるため、**触らない**こと。

## 4. 環境変数の設定

Vercel ダッシュボードの **Settings → Environment Variables** から、以下を
Production / Preview の両方に登録する。値は [`/.env.example`](../.env.example)
のコメントを参照しつつ各サービスから発行する。

### 必須

| 変数 | 用途 | 取得元 |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity プロジェクト識別子（クライアントも参照） | [sanity.io/manage](https://www.sanity.io/manage) → 対象プロジェクト → API → Project ID |
| `NEXT_PUBLIC_SANITY_DATASET` | データセット名（通常 `production`） | [sanity.io/manage](https://www.sanity.io/manage) → Datasets |
| `ANTHROPIC_API_KEY` | Claude API キー（サーバ側のみ） | [console.anthropic.com](https://console.anthropic.com/) → Settings → API Keys |

### 推奨

| 変数 | 用途 |
|---|---|
| `ANTHROPIC_MODEL` | 既定 `claude-sonnet-4-5`。検証時に別モデルを試す用 |
| `NEXT_PUBLIC_APP_URL` | OG / canonical 用。本番の公開 URL を Production のみに設定 |

### 任意

| 変数 | 用途 |
|---|---|
| `SANITY_API_TOKEN` | 下書きプレビューや書き込みが必要な場合のみ。Viewer / Editor の最小権限で発行 |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 地図ビュー有効化。未設定時はリスト表示のみで動作 |
| `OCEANS_BASEPATH` | `/tenant-search` 配下にホストする場合のみ `/tenant-search` を指定 |

⚠ 「`NEXT_PUBLIC_` で始まる変数はバンドルに含まれて公開される」点を必ず意識する。
キー類（`ANTHROPIC_API_KEY` / `SANITY_API_TOKEN`）には**絶対に** `NEXT_PUBLIC_` を
付けないこと。

## 5. Preview と Production の使い分け

- **Production**: `main` ブランチへの push が自動で本番デプロイされる
- **Preview**: それ以外のブランチ / Pull Request ごとに自動で Preview URL が払い出される
- Preview の URL は PR の Conversation タブに Vercel Bot が自動投稿する
- 環境変数のスコープは Vercel UI 上で `Production` / `Preview` / `Development` を
  個別に指定可能。本番のみに公開 URL を入れたい場合は Production スコープで設定

## 6. 初回デプロイの実行

1. **Deploy** ボタンを押す
2. ビルドログで以下が順に表示されることを確認:
   - `Installing dependencies...`（pnpm install --frozen-lockfile）
   - `Running "pnpm --filter @oceans-tenant/web build"`
   - `Compiled successfully`
3. デプロイ完了後、払い出された URL でトップページが表示されることを確認

## 7. （任意）カスタムドメインの追加

`demo.oceans-base.com/tenant-search` などのサブドメイン運用は
[`docs/DEPLOY.md`](./DEPLOY.md) に詳細あり。`OCEANS_BASEPATH` 環境変数の取り扱い
についても同ドキュメントを参照。

## Troubleshooting

ビルドが失敗した場合、以下を順に確認する。

### 1. `ERR_PNPM_OUTDATED_LOCKFILE`

Vercel が `pnpm install --frozen-lockfile` でこけている場合、
ローカルで `pnpm-lock.yaml` が `package.json` と乖離している可能性がある。

```bash
pnpm install            # lockfile を更新
git add pnpm-lock.yaml
git commit -m "chore(deps): pnpm-lock.yaml を同期"
```

### 2. `Cannot find module '@oceans-tenant/shared'`

monorepo のワークスペース解決が失敗している。原因はだいたい以下のいずれか:

- Root Directory を `apps/web` に変更してしまっている → ルート (`./`) に戻す
- `pnpm-workspace.yaml` の `packages` パターンが壊れている → リポジトリの該当ファイル参照

### 3. `Module not found: Can't resolve './foo.js'`

`packages/shared` 内の `.ts` ファイルを `.js` 拡張子付きで import している箇所が
解決できていない。`apps/web/next.config.ts` の `webpack.resolve.extensionAlias`
設定が効いているか確認する（Turbopack build は現在未対応のため `next build` の
webpack 経路を使用）。

### 4. Sanity Studio が 404

`apps/web/src/app/studio/[[...tool]]/page.tsx` は `NEXT_PUBLIC_SANITY_PROJECT_ID`
と `NEXT_PUBLIC_SANITY_DATASET` が未設定だとフォールバック表示になる。両環境変数を
Vercel に登録しているか確認。

### 5. AI 連携 (`/api/chat-search`, `/api/ingest-url`) が 500

`ANTHROPIC_API_KEY` の登録漏れ、または期限切れ。Vercel の Runtime Logs で
スタックトレースを確認。

### 6. Function timeout（30s 超え）

`vercel.json` で `apps/web/src/app/api/**/route.ts` の `maxDuration` を 60 秒に
設定済み。これを超えるリクエストは Vercel プランの上限に達している可能性が
あるため、AI 呼び出し側のタイムアウトを見直す。

## 本番運用注意点（必読）

`demo.oceans-base.com/tenant-search` のような **公開 OSS デモ** として運用する場合、
認証なし・admin 非公開・書き込み無効を含む運用ガードを必ず守ること。

- 本番デモ向け env テンプレート: [`/.env.production.example`](../.env.production.example)
- 本番運用ガイド: [`docs/PRODUCTION_SAFETY.md`](./PRODUCTION_SAFETY.md)
  - デモ運用の前提（認証なし / `/admin` 非公開 / 書き込み無効推奨）
  - コスト管理（Anthropic 月次アラート / レート制限 / Sanity 無料枠）
  - `NEXT_PUBLIC_*` の inline 仕様と機密 env の分離
  - 既知の制約（in-memory rate limit / vitals store）
  - インシデント対応（脆弱性報告 / 緊急時ロールバック）
  - Vercel Production 反映前のチェックリスト

Security Headers（`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`）は [`apps/web/next.config.ts`](../apps/web/next.config.ts) で
全パスに付与する構成。CSP は next-intl / 動的 chart / OG 画像との相性検証が必要なため
別 PR で慎重に導入する。
