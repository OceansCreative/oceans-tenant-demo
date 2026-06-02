# セキュリティポリシー

OceansTenant の脆弱性報告と対応方針をまとめます。

## サポート対象バージョン

| バージョン | 状態 |
|---|---|
| `main` | ✅ 修正対象 |
| 最新の Release タグ（v1.0.0 以降） | ✅ 重大脆弱性のみ |
| 過去の Release タグ（v0.x） | ⚠ 個別判断 |

本プロジェクトはリファレンス実装のため、原則として `main` のみを対応対象とします。
v1.0.0 以降は最新の安定タグに対しても重大脆弱性（CVSS 7.0 以上）への対応を行います。

## 脆弱性の報告先

**公開 Issue で報告しないでください。**

### 第一選択: GitHub Security Advisories

GitHub Security Advisories を利用して private に報告してください:

👉 [Report a vulnerability](https://github.com/OceansCreative/oceans-tenant-demo/security/advisories/new)

### 第二選択: メール

GitHub アカウントが無い場合は、以下のメールアドレスに報告してください:

- メール: kazushi6111@gmail.com
- 件名プレフィックス: `[SECURITY] OceansTenant: <概要>`

### 報告に含めていただきたい情報

- 脆弱性の種類（例: XSS, SSRF, Prototype Pollution, シークレット漏洩 など）
- 影響を受けるファイル / 行 / コミット SHA
- 再現手順（PoC があれば添付）
- 影響範囲と深刻度の見積もり（可能なら CVSS スコア）
- 想定される修正方針（任意）

## 対応 SLA

| イベント | 目安 |
|---|---|
| 初回受領確認 | 24 時間以内 |
| 深刻度の評価とトリアージ | 7 営業日以内 |
| 修正リリース（深刻度: 致命的 / 高） | 7 日以内 |
| 修正リリース（深刻度: 中） | 30 日以内 |
| 修正リリース（深刻度: 低） | 90 日以内 |
| 公開（CVE 取得・Advisory 公表） | 修正リリース後 7 日以内 |

リファレンス実装としての性質上、本番運用される想定はしていませんが、
公開 OSS としての責任を果たすため、報告には誠実に対応します。

## 過去の対応事例

公開 Advisory がある場合は GitHub の [Security advisories](https://github.com/OceansCreative/oceans-tenant-demo/security/advisories) を参照してください。
特筆すべき修正履歴を以下に記録します。

### v0.7.0（PR #116, 2026-06-03）— CodeQL 高深刻度警告 2 件を解消

| CodeQL Rule | 深刻度 | 内容 | 対応 |
|---|---|---|---|
| `js/insecure-randomness` | high | UUID v4 のフォールバック実装で `Math.random` を使用しており、セッション識別子として予測可能 | `crypto.getRandomValues` で RFC 4122 §4.4 準拠の v4 を直接組み立てる実装に置換。`crypto` API が無い環境では明示的に throw |
| `js/incomplete-url-substring-sanitization` | high | OG 画像テストで `url.includes("fonts.googleapis.com")` のような URL 部分文字列マッチを使用 | `new URL(url).hostname === "fonts.googleapis.com"` の hostname 厳密比較に変更 |

修正コミット: `apps/web/src/lib/uuid.ts` / `apps/web/src/lib/seo/og.tsx` 周辺。
詳細は [CHANGELOG.md v0.7.0](CHANGELOG.md#070--2026-06-03) を参照。

### v0.1.1〜v0.1.6（SSRF 多層防御）

`/api/ingest-url` で外部 URL を取得する際の SSRF 対策を多層で実装:

- private IP（10.x / 172.16-31.x / 192.168.x / 127.x / ::1 等）への接続を遮断
- DNS 解決後の IP を再検証（rebinding 対策）
- `http://` / `https://` 以外のプロトコルを拒否
- response size / timeout の上限を設定

詳細は [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md) の SSRF 防御の章を参照。

## 秘密情報の取り扱い

- API キー / トークンは `.env*` に置き、`.gitignore` で除外しています
- `.env.example` 以外をコミットしないでください
- リポジトリに誤って秘密情報をコミットした場合は、すぐに該当キーを失効させ、Security Advisory で報告してください
- pre-commit フックで秘密情報検出を行います（Husky + commitlint で type 違反を検知 / git secrets 系は CI で補完）

## 依存パッケージの脆弱性

- Dependabot を有効化し、週次で依存更新 PR が作成されます
- CodeQL による静的解析が PR / push / 週次で走ります（`.github/workflows/codeql.yml`）
- 高深刻度のアラートが出た場合、優先的に修正します

## スコープ外（既知の制約）

リファレンス実装としての性質上、以下は **脆弱性報告の対象外** とします（[docs/MIGRATION.md](docs/MIGRATION.md) の「既知の制約」も参照）:

- **認証なし**: 本リポジトリは demo であり、認証層は実装していません。`/agent` / `/studio` / `/insights` は OSS デモ用に公開しており、本番想定では認証保護下に置く前提です
- **in-memory レート制限**: サーバレス各インスタンスで独立するため、本番ワークロードでは外部ストア（Upstash Redis 等）への置換が前提
- **`/agent` 等の admin UI は feature flag 制**: 本リポジトリでは常時有効ですが、本番では `OCEANS_ENABLE_AGENT` で無効化できます
- **mock fallback**: env 未設定時は mock データで動作します。本番デプロイ時は必ず env を設定し、`/api/health` で接続確認してください

### 一方で、対象とするもの

- AI 抽出経路（`/api/ingest-url`）の SSRF / プロンプトインジェクション
- 対話検索（`/api/chat-search`）の GROQ インジェクション、SSE ハイジャック
- Sanity GROQ クエリのインジェクション、`fetch` の認証スコープ漏れ
- secret の公開リポジトリへの混入
- CSP / X-Frame-Options 等のセキュリティヘッダ未設定

## 関連ドキュメント

- [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md) — SSRF 防御 / プロンプト設計
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — セキュリティ要点
- [docs/MIGRATION.md](docs/MIGRATION.md) — 既知の制約
- [CLAUDE.md](CLAUDE.md) — 開発規約と禁止事項
