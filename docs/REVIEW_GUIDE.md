# レビューガイド（次セッション用）

本ドキュメントは v0.1.0 完成後のコードレビューを別セッションで効率的に進めるための入口です。
レビュアー（Claude / 人間）はまずこのファイルから読むことを想定しています。

---

## TL;DR

- **完了状態**: Phase 1〜4 全 32 Issue / 19 PR をマージ、`v0.1.0` タグ作成、CI 全 green
- **未完**: 実 Vercel デプロイ / 実 Sanity 接続 / スクリーンショット撮影（v0.1.1 で実施予定）
- **既知の意図的な妥協**: 認証なし（仕様）、ANTHROPIC_API_KEY なしでも UI は動作（フォールバック）、TS 6 系は未追従

## 30 秒で全体像

```text
apps/
├─ web/          Next.js 15 App Router（Server Components / API Routes / Tailwind v4）
└─ studio/       Sanity Studio v3（schemas/ に 5 ドキュメントタイプ）

packages/
└─ shared/       Zod スキーマと型（apps/web と apps/studio 両方で参照）

scripts/python/  ダミーデータ seed と検索ログ分析（pydantic / faker / pandas）

e2e/             Playwright（5 シナリオ × 2 ブラウザ）

docs/            spec.md / ARCHITECTURE.md / AI_INTEGRATION.md / DEPLOY.md / images/
```

詳細は [ARCHITECTURE.md](ARCHITECTURE.md) を参照。

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

- [ ] `/api/query-build` はホワイトリスト方式で GROQ を構築している
  → 不正な ref / city / 長すぎる値は `GroqInjectionError` で 400
- [ ] `/api/ingest-url` は URL を `isValidIngestUrl()` で http(s) 限定
- [ ] Claude API キー未設定時は 503 で親切なメッセージ
- [ ] プロンプトに秘密情報・実在企業名が埋め込まれていない
- [ ] HTML 抽出は 12,000 文字でトリム（DoS 対策）

### 3. テストと CI

- [ ] Vitest: `apps/web/tests/` と `apps/web/src/**/__tests__/` を `vitest.config.ts` で拾えている
- [ ] pytest: `scripts/python/tests/` で 40 ケース pass、coverage 99%
- [ ] Playwright: `e2e/tests/search-flow.spec.ts` で 5 シナリオ × 2 ブラウザ
- [ ] CI: `.github/workflows/ci.yml` で Lint / typecheck / Vitest / pytest が並列実行
- [ ] CI: `.github/workflows/e2e.yml` で `next build && next start` + Playwright
- [ ] CodeQL: 週次 + PR で TypeScript / JavaScript を解析
- [ ] Dependabot: 週次で pnpm / pip / github-actions を更新

### 4. 型と Lint

- [ ] `pnpm typecheck` が全ワークスペースで pass
- [ ] `pnpm lint`（Biome）が pass、警告のみ許容
- [ ] `any` 不使用（CLAUDE.md 原則 2）
- [ ] `as never` / `as unknown as ...` が必要最小限（query-build / chat-search の型橋渡しのみ）

### 5. UI / UX

- [ ] `<html lang="ja">` / Noto Sans JP / skip link が `app/layout.tsx` に
- [ ] 全コンポーネントが Tailwind v4 のトークン (`brand-*` など) を一貫使用
- [ ] フォーム要素に `aria-label`、ボタン群に `aria-pressed`
- [ ] モバイルでも崩れない（`/search` の sticky フィルタ、`/chat` の 2 ペイン）
- [ ] PropertyCard の領域全体をリンクにする `after:absolute` パターン
- [ ] availability バッジの色分けが a11y に配慮されている

### 6. ドキュメント

- [ ] [README.md](../README.md): 第三者がセットアップ完結可能
- [ ] [docs/ARCHITECTURE.md](ARCHITECTURE.md): mermaid 全体図 + ER 図
- [ ] [docs/AI_INTEGRATION.md](AI_INTEGRATION.md): プロンプトと SSE イベント仕様
- [ ] [docs/DEPLOY.md](DEPLOY.md): Vercel + DNS + 環境変数
- [ ] [CHANGELOG.md](../CHANGELOG.md): Keep a Changelog 形式で v0.1.0 を網羅
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
| スクリーンショット | placeholder のみ | 実 Sanity 接続後の v0.1.1 で撮影 |
| `as never` 等の橋渡しキャスト | 限定箇所のみ | Zod の `.default([])` が出力型に readonly readonly を持ち込むため |

## 重点的に見てほしい / 議論したい箇所

1. **`packages/shared/src/property/schema.ts`** の `aiExtractionMetaSchema.superRefine` — `aiExtracted` と `aiConfidence` の相互制約は他にも適用すべき箇所がないか
2. **`apps/web/src/lib/ai/prompts/query-build.ts`** の `escapeString` — クォート除去より errorOut の方が安全か
3. **`apps/web/src/app/api/chat-search/route.ts`** の `parseClaudeCriteriaResponse` — Claude が壊れた JSON を返した場合の fallback は妥当か
4. **`apps/web/src/components/chat/ChatPanel.tsx`** の SSE クライアント — `buffer.split("\n\n")` だけで境界判定して大丈夫か

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
