# デプロイ手順

OceansTenant を `demo.oceans-base.com/tenant-search` で公開するための手順をまとめます。

## 1. Vercel プロジェクトの作成

1. [Vercel](https://vercel.com/) にログインし、`OceansCreative/oceans-tenant-demo` を import
2. Framework Preset: **Next.js**（自動検出される）
3. Root Directory: そのまま（モノレポはルートで OK）
4. Build & Output Settings:
   - Build Command: `pnpm --filter @oceans-tenant/web build`（`vercel.json` で固定済み）
   - Install Command: `pnpm install --frozen-lockfile`
   - Output: 自動検出
5. Region: `hnd1`（東京）固定 — `vercel.json` で指定済み

## 2. 環境変数の設定

| 変数 | 環境 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Production / Preview | Sanity プロジェクト |
| `NEXT_PUBLIC_SANITY_DATASET` | Production / Preview | 既定 `production` |
| `SANITY_API_TOKEN` | Production / Preview | 書き込み権限のトークン |
| `ANTHROPIC_API_KEY` | Production / Preview | Claude API |
| `ANTHROPIC_MODEL` | Production / Preview | 既定 `claude-sonnet-4-5` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Production / Preview | 任意。未設定時は地図ビュー無効 |
| `NEXT_PUBLIC_APP_URL` | Production | `https://demo.oceans-base.com/tenant-search` |
| `CODECOV_TOKEN` | GitHub Secrets | カバレッジ送信用 |

⚠ Production 環境変数は Vercel ダッシュボードから入力し、リポジトリにはコミットしない。

## 3. カスタムドメインと basePath

### サブドメインを切る

1. Vercel プロジェクトの Settings → Domains で `demo.oceans-base.com` を追加
2. DNS プロバイダで CNAME を Vercel が提示するエンドポイントに向ける（例: `cname.vercel-dns.com`）
3. SSL は Vercel が Let's Encrypt で自動取得

### `/tenant-search` でホストする

このリポジトリは Next.js の `basePath` 機構を用いて `/tenant-search` 配下に配信できます。

設定済みファイル: `apps/web/next.config.ts`

```ts
const isProd = process.env.NODE_ENV === "production";
const nextConfig: NextConfig = {
  basePath: isProd && process.env.OCEANS_BASEPATH === "/tenant-search" ? "/tenant-search" : "",
  ...
};
```

Vercel 環境変数で `OCEANS_BASEPATH=/tenant-search` を設定すると basePath が有効になり、
ローカル開発時は `/` のままで動作します。

## 4. プレビュー環境

- すべての PR で Preview Deployment が作成されます
- Preview の URL は PR コメントに自動投稿されます
- Preview 環境変数を別途設定したい場合は Vercel ダッシュボードで指定

## 5. リリースフロー

1. `main` にマージされると Vercel が Production をビルド・デプロイ
2. GitHub Release タグ（`v0.1.0` など）を作成
3. CHANGELOG.md を更新

## 6. 監視

- **エラー**: Vercel のランタイムログ + Sentry（将来導入）
- **CI**: GitHub Actions（ci.yml / e2e.yml / codeql.yml）
- **依存**: Dependabot（週次）

## 7. ロールバック

```bash
# 直近のデプロイを巻き戻す
vercel rollback
# 特定のデプロイ URL に切替
vercel alias set <deployment-url> demo.oceans-base.com
```
