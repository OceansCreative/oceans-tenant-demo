# レビューガイド（次セッション用）

本ドキュメントは v0.1.2 完成後のコードレビューを別セッションで効率的に進めるための入口です。
レビュアー（Claude / 人間）はまずこのファイルから読むことを想定しています。

---

## TL;DR

- **完了状態**: Phase 1〜4 全 32 Issue + レビュー指摘 4 件（SSRF + medium 3）を解消、`v0.1.0` / `v0.1.1` / `v0.1.2` の 3 タグ作成、CI 全 green
- **未完**: 実 Vercel デプロイ / 実 Sanity 接続 / スクリーンショット撮影（v0.2.0 で実施予定）
- **既知の意図的な妥協**: 認証なし（仕様）、ANTHROPIC_API_KEY なしでも UI は動作（フォールバック）、TS 6 系は未追従

## バージョン履歴（重要）

| タグ | 内容 | 関連 Issue |
|---|---|---|
| v0.1.0 | 初回リリース（Phase 1〜4 全 32 Issue） | #1-44 |
| v0.1.1 | SSRF 修正（CWE-918） | [#54](https://github.com/OceansCreative/oceans-tenant-demo/issues/54) |
| v0.1.2 | medium hardening バンドル | [#55](https://github.com/OceansCreative/oceans-tenant-demo/issues/55) [#56](https://github.com/OceansCreative/oceans-tenant-demo/issues/56) [#57](https://github.com/OceansCreative/oceans-tenant-demo/issues/57) |

**前回レビューで指摘された 4 件は全て対応済**。詳細は [CHANGELOG.md](../CHANGELOG.md) を参照。
今回のレビューは **新規の指摘** を探すフェーズです。

## 30 秒で全体像

```text
apps/
├─ web/          Next.js 15 App Router（Server Components / API Routes / Tailwind v4）
└─ studio/       Sanity Studio v3（schemas/ に 5 ドキュメントタイプ）

packages/
└─ shared/       Zod スキーマと型（apps/web と apps/studio 両方で参照）
                 - property / realEstateCompany / businessCategory / area / searchSession
                 - searchCriteria  ← v0.1.2 新設、API レイヤ共通の検証

scripts/python/  ダミーデータ seed と検索ログ分析（pydantic / faker / pandas）

e2e/             Playwright（5 シナリオ × 2 ブラウザ）

docs/            spec.md / ARCHITECTURE.md / AI_INTEGRATION.md / DEPLOY.md /
                 REVIEW_GUIDE.md / images/
```

詳細は [ARCHITECTURE.md](ARCHITECTURE.md) を参照。

## v0.1.0 → v0.1.2 で増えた要点（重点確認箇所）

### `apps/web/src/lib/ai/url-safety.ts`（v0.1.1）

- `assertPublicIp(hostname)`: DNS 解決後の IP を IPv4 17 レンジ / IPv6 7 レンジで block-list 判定
- `fetchHtmlSafe(url, opts)`: per-hop SSRF 検証（`redirect: "manual"`）、最大 3 ホップ、最大 5MB、12s タイムアウト、DNS / fetch を DI 可能
- 単体テスト 36 ケース（IPv4 / IPv6 拒否レンジ、リダイレクトバイパス、サイズ超過、スキーム拒否）

### `packages/shared/src/searchCriteria/schema.ts`（v0.1.2）

- `searchCriteriaSchema` (Zod): 都道府県 enum / 賃料・面積範囲 / 建物形態 / 物件状態 / 業種 ref パターン / `min<=max` superRefine / strict
- `/api/query-build` と `/api/chat-search` の両方で共有
- `SearchCriteria` 型は `ReadonlyArray` にマッピングして web 既存コードと互換
- 単体テスト 16 ケース

### `/api/chat-search` の hardening（v0.1.2）

- `parseClaudeCriteriaResponse`: Claude 出力を `searchCriteriaSchema.safeParse()` で必ず再バリデーション
- `sanitizeErrorForClient`: SDK 内部メッセージ等を定型文に丸める（ANTHROPIC_API_KEY 透過は維持）

## レビュー観点（優先度順）

### 1. 仕様適合性

- [ ] `docs/spec.md` の §6（スキーマ）と `packages/shared/src/*/schema.ts` が 1:1 で対応している
- [ ] `apps/studio/schemas/*.ts` が同様に対応している
- [ ] 禁止事項（`CLAUDE.md` 末尾）に違反していない:
  - localStorage / sessionStorage 不使用
  - 認証実装なし
  - 課金実装なし
  - クライアント情報・実在企業名なし

### 2. AI 連携の安全性

- [ ] `/api/query-build` は `searchCriteriaSchema` で入力検証、`buildPropertyGroq` がホワイトリスト方式
  → 不正な ref / city / 長すぎる値は `GroqInjectionError` で 400
- [ ] `/api/ingest-url` は `fetchHtmlSafe` 経由で URL → DNS → IP を per-hop 検証（v0.1.1）
- [ ] `/api/chat-search` は Claude 出力を `searchCriteriaSchema.safeParse()` で再バリデーション（v0.1.2）
- [ ] SSE エラーは `sanitizeErrorForClient` で定型文に丸める（v0.1.2）
- [ ] Claude API キー未設定時は 503 で親切なメッセージ
- [ ] プロンプトに秘密情報・実在企業名が埋め込まれていない
- [ ] HTML 抽出は 12,000 文字でトリム（DoS 対策）

### 3. テストと CI

- [ ] Vitest: `apps/web/tests/` と `apps/web/src/**/__tests__/` を `vitest.config.ts` で拾えている
- [ ] shared 135 / web 128 / pytest 40 / Playwright 5 シナリオ × 2 ブラウザ
- [ ] CI: `.github/workflows/ci.yml` で Lint / typecheck / Vitest / pytest が並列実行
- [ ] CI: `.github/workflows/e2e.yml` で `next build && next start` + Playwright
- [ ] CodeQL: 週次 + PR で TypeScript / JavaScript を解析
- [ ] Dependabot: 週次で pnpm / pip / github-actions を更新

### 4. 型と Lint

- [ ] `pnpm typecheck` が全ワークスペースで pass
- [ ] `pnpm lint`（Biome）が pass、警告のみ許容
- [ ] `any` 不使用（CLAUDE.md 原則 2）
- [ ] `as never` / `as unknown as ...` が必要最小限

### 5. UI / UX

- [ ] `<html lang="ja">` / Noto Sans JP / skip link が `app/layout.tsx` に
- [ ] 全コンポーネントが Tailwind v4 のトークン (`brand-*` など) を一貫使用
- [ ] フォーム要素に `aria-label`、ボタン群に `aria-pressed`
- [ ] モバイルでも崩れない（`/search` の sticky フィルタ、`/chat` の 2 ペイン）
- [ ] PropertyCard の領域全体をリンクにする `after:absolute` パターン
- [ ] availability バッジの色分けが a11y に配慮されている
- [ ] ChatPanel の自動スクロールが新規メッセージで末尾追従する（v0.1.2 修正）

### 6. ドキュメント

- [ ] [README.md](../README.md): 第三者がセットアップ完結可能
- [ ] [docs/ARCHITECTURE.md](ARCHITECTURE.md): mermaid 全体図 + ER 図
- [ ] [docs/AI_INTEGRATION.md](AI_INTEGRATION.md): プロンプト、SSE イベント、SSRF 防御、Claude 出力再バリデーション
- [ ] [docs/DEPLOY.md](DEPLOY.md): Vercel + DNS + 環境変数
- [ ] [CHANGELOG.md](../CHANGELOG.md): v0.1.0 / v0.1.1 / v0.1.2 全て記載
- [ ] CONTRIBUTING / SECURITY / CODE_OF_CONDUCT が揃っている

## 起動・検証手順

```bash
# 1. Node 20 LTS と pnpm 9.15.4 を用意
corepack prepare pnpm@9.15.4 --activate

# 2. クローンと依存
git clone https://github.com/OceansCreative/oceans-tenant-demo.git
cd oceans-tenant-demo
pnpm install

# 3. ローカル動作確認
cp .env.example .env.local       # キーは未設定でも UI は動く
pnpm dev                          # http://localhost:3000

# 4. テスト
pnpm lint                         # Biome
pnpm typecheck                    # 全ワークスペース tsc --noEmit
pnpm test                         # Vitest 全ワークスペース

# 5. Python
cd scripts/python
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt 'pydantic[email]'
.venv/bin/pytest --cov

# 6. E2E
pnpm --filter @oceans-tenant/web exec playwright install --with-deps chromium
pnpm --filter @oceans-tenant/web exec playwright test
```

## 既知の妥協（意図的）

| 項目 | 状態 | 理由 |
|---|---|---|
| 認証 | 実装なし | `CLAUDE.md` 禁止事項 |
| `/agent` の company 固定 | `company-001` で固定表示 | 認証なしで自社判定するため |
| TypeScript 6.0 | 5.9.3 で固定 | 主要依存（Sanity / Next.js）の types との互換性未確認 |
| Sanity Studio 埋め込み | プレースホルダーのみ | `next-sanity` の `NextStudio` 統合は v0.2.0 で |
| スクリーンショット | placeholder のみ | 実 Sanity 接続後の v0.2.0 で撮影 |
| GROQ パラメータ化 + `escapeString` の二重防御 | 両方残置 | パラメータ化で注入は遮断済だが defense-in-depth として残す |

## 解消済みの過去指摘（重複指摘を避けるための備忘）

| 指摘 | 解消方法 | リリース |
|---|---|---|
| SSRF in `/api/ingest-url` (CWE-918) | `fetchHtmlSafe` + `assertPublicIp` で多層防御 | v0.1.1 / #54 |
| SSE エラー `error.message` 露出 | `sanitizeErrorForClient` で定型文化 | v0.1.2 / #55 |
| ChatPanel 自動スクロールが効かない | useEffect 依存配列を修正 | v0.1.2 / #56 |
| chat-search の Claude 出力が未検証 | `searchCriteriaSchema.safeParse()` を強制 | v0.1.2 / #57 |
| 500 応答の `details: message` 情報漏洩 | 削除し `console.error` のみに | v0.1.1 / #54 |
| `escapeString` の妥当性議論 | パラメータ化で注入遮断済、二重防御として残置で合意 | discussion |
| SSE 境界判定 `buffer.split("\n\n")` | 仕様通りで適切と合意 | discussion |
| `aiExtractionMetaSchema.superRefine` の相互制約 | 現状で十分と合意 | discussion |

## 重点的に見てほしい / 議論したい箇所（v0.1.2 時点）

過去のレビューで議論済の論点は上の表で消化済み。今回は新規の観点で:

1. **`apps/web/src/lib/ai/url-safety.ts`** — IPv6 の private レンジ判定が正規表現ベース。`fc00::` のような短縮 / 省略形（`fc0:`）に取りこぼしがないか
2. **`packages/shared/src/searchCriteria/schema.ts`** — `superRefine` で `min<=max` を検査しているが、`minRent` だけ指定して `maxRent` 未指定のケースで意図したとおりに動くか
3. **`apps/web/src/app/api/chat-search/route.ts`** の `parseClaudeCriteriaResponse` — Claude が一部フィールドだけ返してきた場合、検証に通る最小ペイロードと UX のバランスは妥当か
4. **`/api/ingest-url`** の `propertySchema.parse(draftWithDefaults)` — Claude が strict schema を満たさない部分応答を返したとき、デフォルト値で埋めてからパースする方針の安全性
5. **`apps/web/next.config.ts`** の `webpack.resolve.extensionAlias` — モノレポで `.js` 拡張子インポートを `.ts` に解決する設定が turbopack / Next.js 16 で動かなくなるリスクの評価
6. **Python `scripts/python/oceans_tenant_seed/sanity_client.py`** — `requests.Session` のリトライ・タイムアウト戦略が未実装。シードのべき等性

## ロードマップ（v0.2.0 候補）

- [ ] `next-sanity` の `NextStudio` で `/studio` を実 Studio に
- [ ] Sanity 実プロジェクトへの GROQ 接続（mock を撤去）
- [ ] Claude Tool Use で `propertySchema` を JSON Schema として渡す
- [ ] Vercel 実デプロイと `demo.oceans-base.com/tenant-search` 公開
- [ ] スクリーンショット撮影 → README へ
- [ ] TypeScript 6.x 対応
- [ ] 一覧のページネーション（現状は全件返却）
- [ ] Lighthouse Performance 90+ を CI で計測

## 連絡先

- Issue: https://github.com/OceansCreative/oceans-tenant-demo/issues
- Security: GitHub Security Advisory（[SECURITY.md](../SECURITY.md)）
- メール: kazushi6111@gmail.com（CODE_OF_CONDUCT 経由）
