# 本番運用ガイド（PRODUCTION_SAFETY）

本ドキュメントは `demo.oceans-base.com/tenant-search` を含む **公開 OSS デモ** を
安全に運用するための制約と推奨事項をまとめる。実プロダクトに転用する場合の
ベースラインとしても参照可能。

関連: [.env.production.example](../.env.production.example) ・
[docs/DEPLOYMENT.md](./DEPLOYMENT.md) ・
[SECURITY.md](../SECURITY.md) ・
[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)

## 1. デモ運用の前提

OceansTenant は **リファレンス実装** であり、本番デモは「動作確認可能な OSS の
ショーケース」として公開する。以下の前提を必ず守ること。

- **認証は実装しない**（[CLAUDE.md](../CLAUDE.md) 禁止事項）。
  公開デモは全エンドポイントが匿名アクセス可能である前提で設計する。
- **`/admin` は本番デモでは非公開**。`NEXT_PUBLIC_ADMIN_ENABLED=false` を
  デフォルトとし、middleware で 404 にする
  （[apps/web/src/lib/admin/feature-flag.ts](../apps/web/src/lib/admin/feature-flag.ts)）。
- **書き込み API は無効推奨**。`SANITY_API_TOKEN`（書き込み権限）を Vercel Production
  に登録しないことで、ingest / admin から Sanity への書き込みを物理的に不可能にする。
  読み取りは `SANITY_API_READ_TOKEN`（Viewer）のみで完結する。
- **クライアント情報・営業文脈・実在企業名・実在物件情報は混入させない**
  （[CLAUDE.md](../CLAUDE.md) 禁止事項）。

## 2. コスト管理

公開デモで最大のリスクは Anthropic API の無制限消費。以下を必ず実施する。

### 2.1 Anthropic 側の予算アラート

[console.anthropic.com](https://console.anthropic.com/) → Settings → Limits から
**月次予算アラート**（usage alert / spend limit）を設定する。デモ運用では月数十
ドル程度を上限の目安とする。

### 2.2 アプリ側のレート制限

すべての AI 呼び出し API はトークンバケットで保護されている。デフォルト値は
[`apps/web/src/lib/rate-limit.ts`](../apps/web/src/lib/rate-limit.ts) を参照。

| API | env | デフォルト |
|---|---|---|
| `/api/chat-search` | `RATE_LIMIT_CHAT_CAPACITY` / `RATE_LIMIT_CHAT_REFILL_INTERVAL_MS` | 20 / 6000 ms |
| `/api/ingest-url` | `RATE_LIMIT_INGEST_CAPACITY` / `RATE_LIMIT_INGEST_REFILL_INTERVAL_MS` | 10 / 12000 ms |

⚠ 現状の rate limit は **in-memory（プロセス単位）**。Vercel の serverless では
function instance ごとに独立しているため、実効容量は同時実行 instance 数で乗算
される。本格運用では Upstash Redis / Vercel KV への移行を検討
（[docs/ROADMAP.md](./ROADMAP.md)）。

### 2.3 Sanity の枠

Sanity Free プランは月 100k API request / 5GB アセットまで。公開デモであっても
GROQ クエリは Next.js 側でキャッシュされる（ISR / `revalidate`）ため通常は無料枠
で収まるが、急増した際は Sanity 側のダッシュボードでモニタすること。

## 3. データ漏えい防止

### 3.1 `NEXT_PUBLIC_*` の inline 仕様

`NEXT_PUBLIC_` 接頭辞の env は **ビルド時に client bundle へ inline** される
（Next.js 仕様）。一度デプロイされたら、その値はブラウザの DevTools / view-source
から取得可能と考えること。

| 接頭辞 | 配置 | 例 |
|---|---|---|
| `NEXT_PUBLIC_*` | client bundle へ inline | `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| （無印） | server のみ（process.env 経由） | `ANTHROPIC_API_KEY`, `SANITY_API_TOKEN`, `SANITY_API_READ_TOKEN` |

機密情報には**絶対に `NEXT_PUBLIC_` を付けない**。`SANITY_API_TOKEN` や
`ANTHROPIC_API_KEY` がもし `NEXT_PUBLIC_*` で登録されると、デプロイ直後に bundle
内へ inline されてキー漏えいが発生する。

### 3.2 Google Maps API キー

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` は client に inline される前提で、
**Google Cloud Console 側で HTTP リファラ制限**（`https://demo.oceans-base.com/*`
等）を必ず設定する。リファラ制限なしのキーをデプロイすると課金事故が起きる。

### 3.3 リポジトリ側の防御

- pre-commit hook（[.husky/pre-commit](../.husky/pre-commit)）で Biome check
- CI で CodeQL（[.github/workflows/codeql.yml](../.github/workflows/codeql.yml)）
- `.env*` は `.gitignore` で除外。テンプレートはプレースホルダのみ
  （[.env.example](../.env.example) ・ [.env.production.example](../.env.production.example)）

## 4. 既知の制約

| 項目 | 制約 | 緩和策 |
|---|---|---|
| Rate limit | in-memory / serverless instance 独立 | Upstash Redis / Vercel KV 置換（[docs/ROADMAP.md](./ROADMAP.md) v1.x） |
| Vitals store | プロセス単位の in-memory aggregate | Edge Config / KV 置換、または外部 RUM（Datadog 等）連携 |
| 認証 | 未実装（[CLAUDE.md](../CLAUDE.md) 禁止事項） | 本リファレンス実装の範囲外。本番転用時に NextAuth 等を別 PR で実装 |
| SSRF | `/api/ingest-url` は private network への接続をブロック | [docs/AI_INTEGRATION.md](./AI_INTEGRATION.md) 「SSRF 防御」セクション |
| 書き込み | `/api/ingest-url` 等は `SANITY_API_TOKEN` を必要とする | 本番デモでは未設定にして書き込みを無効化（本ドキュメント §1） |

## 5. インシデント対応

### 5.1 脆弱性報告

[SECURITY.md](../SECURITY.md) に沿って GitHub Security Advisories（または
`kazushi6111@gmail.com`）に private 報告を依頼する。公開 Issue で報告しない。

### 5.2 行動規範

利用者間の不適切な行為は [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
（Contributor Covenant v2.1）に従って対応する。

### 5.3 緊急時の取り下げ

公開デモで深刻な不具合（情報漏えい / 大量課金 / 不適切表示）が発生した場合の
最短手順:

1. Vercel ダッシュボードで対象プロジェクトを **Pause** または **Promote to
   Production** で前バージョンへロールバック。
2. Anthropic Console で API キーを **rotate**。
3. Sanity Studio で対象ドキュメントを `unpublish`（必要なら `discardDraft`）。
4. 事後対応は SECURITY.md の SLA に従って告知。

## 6. チェックリスト（Vercel Production へ反映する前）

- [ ] [.env.production.example](../.env.production.example) に従って env を投入
- [ ] `ANTHROPIC_API_KEY` が `NEXT_PUBLIC_*` 接頭辞になっていない
- [ ] `SANITY_API_TOKEN` を未設定（書き込みを物理的に不可能にする）
- [ ] `NEXT_PUBLIC_ADMIN_ENABLED=false`（または未設定）
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` を使う場合は GCP 側で HTTP リファラ制限
- [ ] Anthropic Console で月次予算アラートを設定
- [ ] [SECURITY.md](../SECURITY.md) ・ [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) の連絡先が最新
