# Vercel デプロイ手順（接続するだけで動かす）

OceansTenant の `apps/web`（Next.js 15 App Router）を Vercel にデプロイするための、
step-by-step 手順です。「Vercel に Git リポジトリを繋いで環境変数を入れるだけ」で
preview / production デプロイが通る状態になることを目標としています。

カスタムドメインや `/tenant-search` basePath などのアプリ固有のデプロイ運用は
[`docs/DEPLOY.md`](./DEPLOY.md) を参照してください。本ドキュメントは「初回接続」
にスコープを絞ります。

---

## ⏱ ユーザー作業 30 分セットアップ（最短経路）

「fork して Vercel に接続するだけで `demo.oceans-base.com/tenant-search` 相当が動く」
状態に 30〜40 分で到達するための **作業順序のサマリ**です。詳細は各セクションへの
リンクを参照してください。

| ステップ | 所要 | 内容 |
|---|---|---|
| 1 | 5 分 | [Sanity プロジェクト作成](#step-1) |
| 2 | 5 分 | [Anthropic API キー取得 or 確認](#step-2) |
| 3 | 5 分 | [Vercel に repo を import](#step-3) |
| 4 | 5 分 | [Vercel に環境変数を投入](#step-4)（コピペ用テンプレートあり） |
| 5 | 5 分 | [ダミーデータを Sanity に投入](#step-5)（Python ワンライナー） |
| 6 | 5 分 | [カスタムドメインを Vercel に紐付け](#step-6) |
| 7 | 2 分 | [`NEXT_PUBLIC_APP_URL` を実 URL に更新して再デプロイ](#step-7) |
| 8 | 2 分 | [README の Live Demo を実 URL に更新](#step-8) |

合計目安: **30〜40 分**（既に GitHub アカウント / Vercel アカウント / Sanity アカウント /
Anthropic アカウントが揃っていることが前提）。

### Step 1. Sanity プロジェクト作成 <a id="step-1"></a>

1. <https://www.sanity.io/manage> にログインし、**Create project** を押下
2. プロジェクト名: 任意（例: `oceans-tenant-demo`）
3. データセット: `production`（Public で OK）
4. **API → Project ID** をメモ（`NEXT_PUBLIC_SANITY_PROJECT_ID`）
5. **API → Tokens → Add API token** で `Editor` 権限のトークンを発行し、メモ
   （`SANITY_API_TOKEN` — Python シード時に使用）
6. **API → CORS origins** に `http://localhost:3000` と本番予定 URL を追加

### Step 2. Anthropic API キー取得 or 確認 <a id="step-2"></a>

1. <https://console.anthropic.com/> にログイン
2. **Settings → API Keys → Create Key** で新しいキーを発行（または既存を確認）
3. `sk-ant-...` のキーをメモ（`ANTHROPIC_API_KEY`）
4. **Settings → Billing** で残クレジットを確認（評価ハーネスを動かす場合は 1〜2 USD 程度）

### Step 3. Vercel に repo を import <a id="step-3"></a>

1. リポジトリを GitHub で fork（公開リファレンス実装なので fork で OK）
2. <https://vercel.com/new> を開き **Import Git Repository** で fork した repo を選択
3. Framework Preset: **Next.js**（自動検出）
4. **Root Directory はそのまま（`./`）** — `apps/web` に変えると monorepo 解決が壊れます
5. Build / Install / Output 設定は **すべて空欄のまま**（`vercel.json` で指定済み）
6. **Deploy ボタンはまだ押さない**（環境変数を先に入れる）

### Step 4. Vercel に環境変数を投入 <a id="step-4"></a>

Vercel ダッシュボードの **Settings → Environment Variables** で、以下を
Production / Preview の両方に登録します。

```env
# 必須
NEXT_PUBLIC_SANITY_PROJECT_ID=<Step 1 でメモした Project ID>
NEXT_PUBLIC_SANITY_DATASET=production
ANTHROPIC_API_KEY=<Step 2 でメモしたキー>

# 推奨
ANTHROPIC_MODEL=claude-sonnet-4-5
NEXT_PUBLIC_APP_URL=https://<vercel が払い出す preview URL（後で実 URL に上書き）>

# 任意
SANITY_API_TOKEN=<Step 1 で発行した Editor トークン>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<取得済みなら>
OCEANS_BASEPATH=/tenant-search   # /tenant-search 配下にホストする場合のみ
```

⚠ `ANTHROPIC_API_KEY` / `SANITY_API_TOKEN` には **絶対に `NEXT_PUBLIC_` を付けない**
（公開バンドルに混入します）。詳細な変数解説は [Step 4 詳細セクション](#4-環境変数の設定)
を参照。

登録後に **Deployments → 最新を Redeploy**。初回ビルドが通れば、Vercel が払い出す
preview URL でトップページが見えます（Sanity に物件が 0 件の状態なので `/search` は
空表示でも OK）。

### Step 5. ダミーデータを Sanity に投入 <a id="step-5"></a>

ローカルから Sanity に 50 件の架空物件をシードします。

```bash
cd scripts/python
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt 'pydantic[email]'

# 確認のみ（標準出力に JSON を流す）
SANITY_PROJECT_ID=<Project ID> \
SANITY_DATASET=production \
SANITY_API_TOKEN=<Editor Token> \
.venv/bin/python seed_properties.py --count 50 --dry-run

# 実投入（Sanity に書き込み）
SANITY_PROJECT_ID=<Project ID> \
SANITY_DATASET=production \
SANITY_API_TOKEN=<Editor Token> \
.venv/bin/python seed_properties.py --count 50
```

投入後、Vercel デプロイ URL の `/search` に 50 件が表示されることを確認。

### Step 6. カスタムドメイン `demo.oceans-base.com` を Vercel に紐付け <a id="step-6"></a>

1. Vercel プロジェクトの **Settings → Domains** で `demo.oceans-base.com` を追加
2. DNS プロバイダ（例: Cloudflare / Route 53）で Vercel が提示する CNAME を設定
   - 例: `demo` → `cname.vercel-dns.com`
3. SSL は Let's Encrypt で自動取得（通常 1〜2 分）

`/tenant-search` basePath で公開する場合、Vercel 環境変数 `OCEANS_BASEPATH=/tenant-search`
が登録されていれば、`https://demo.oceans-base.com/tenant-search/` でアクセス可能に
なります（詳細は [`docs/DEPLOY.md`](./DEPLOY.md)）。

### Step 7. `NEXT_PUBLIC_APP_URL` を実 URL に更新して再デプロイ <a id="step-7"></a>

Vercel ダッシュボードの **Settings → Environment Variables** で Production スコープの
`NEXT_PUBLIC_APP_URL` を実 URL に更新します。

```env
NEXT_PUBLIC_APP_URL=https://demo.oceans-base.com/tenant-search
```

更新後、**Deployments → 最新を Redeploy** で OG 画像 / canonical / sitemap.xml に
実 URL が反映されます。

### Step 8. README の Live Demo を実 URL に更新 <a id="step-8"></a>

リポジトリ ルートの `README.md` 冒頭バッジ群直下にある:

```markdown
🌐 **Live Demo**: [demo.oceans-base.com/tenant-search](https://demo.oceans-base.com/tenant-search) — **v1.0.0 公開予定**
```

を、公開後は **「— v1.0.0 公開予定」を削除して実 URL のみに**します。プレースホルダ文言
を外すだけの 1 行修正で済む構造になっています。

### 仕上げ

公開直前の確認は [docs/RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) を上から順に消化
してください。すべて green になった時点で `v1.0.0` タグを切り、GitHub Release を作成
します。

---

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
