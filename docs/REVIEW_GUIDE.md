# レビューガイド（次セッション用）

本ドキュメントは v0.1.5 完成後のコードレビューを別セッションで効率的に進めるための入口です。
レビュアー（Claude / 人間）はまずこのファイルから読むことを想定しています。

---

## TL;DR

- **完了状態**: Phase 1〜4 全 32 Issue + レビュー指摘 11 件（SSRF + medium 3 + DNS rebinding + IPv6 allowlist + DNS pinning 配列形式 + dead assertion + projection 整合 + tsubo 単一真実化 + fetchHtmlSafe E2E）を解消、`v0.1.0`〜`v0.1.5` の 6 タグ作成、CI 全 green
- **未完**: 実 Vercel デプロイ / 実 Sanity 接続 / スクリーンショット撮影（v0.2.0 で実施予定）
- **既知の意図的な妥協**: 認証なし（仕様）、ANTHROPIC_API_KEY なしでも UI は動作（フォールバック）、TS 6 系は未追従

## バージョン履歴（重要）

| タグ | 内容 | 関連 Issue |
|---|---|---|
| v0.1.0 | 初回リリース（Phase 1〜4 全 32 Issue） | #1-44 |
| v0.1.1 | SSRF 修正（CWE-918） | [#54](https://github.com/OceansCreative/oceans-tenant-demo/issues/54) |
| v0.1.2 | medium hardening バンドル | [#55](https://github.com/OceansCreative/oceans-tenant-demo/issues/55) [#56](https://github.com/OceansCreative/oceans-tenant-demo/issues/56) [#57](https://github.com/OceansCreative/oceans-tenant-demo/issues/57) |
| v0.1.3 | DNS rebinding 遮断 + IPv6 アロウリスト化 | [#63](https://github.com/OceansCreative/oceans-tenant-demo/issues/63) [#64](https://github.com/OceansCreative/oceans-tenant-demo/issues/64) |
| v0.1.4 | DNS ピン留め lookup 配列形式リグレッション修正 + 実 undici 結合テスト | [#81](https://github.com/OceansCreative/oceans-tenant-demo/issues/81) |
| v0.1.5 | dead assertion 是正 + projection 整合 + tsubo 単一真実 + fetchHtmlSafe E2E | [#85](https://github.com/OceansCreative/oceans-tenant-demo/issues/85) [#86](https://github.com/OceansCreative/oceans-tenant-demo/issues/86) [#87](https://github.com/OceansCreative/oceans-tenant-demo/issues/87) [#88](https://github.com/OceansCreative/oceans-tenant-demo/issues/88) |

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

## v0.1.0 → v0.1.3 で増えた要点（重点確認箇所）

### `apps/web/src/lib/ai/url-safety.ts`（v0.1.1 + v0.1.3）

- `assertPublicIp(hostname)`: `dns.lookup(host, { all: true })` で **全 A/AAAA** を取得し、`node:net` の `BlockList` で判定（v0.1.3）
  - IPv4: blocklist（17 サブネット、`169.254.169.254` メタデータ含む）
  - IPv6: **`2000::/3` allowlist** + 内部 block（`2001:db8::/32`, `2001::/32` Teredo, `2002::/16` 6to4）
  - IPv4-mapped IPv6 はドット形式 / 16 進形式の両方を展開して再検査、自体も一律拒否
- `fetchHtmlSafe(url, opts)`: per-hop SSRF 検証 + **`undici` の `Agent({ connect: { lookup } })` で検証済み IP を強制注入**し DNS リバインディング (TOCTOU) を遮断（v0.1.3）
- 最大 3 ホップ、最大 5MB、12s タイムアウト、DNS / fetch を DI 可能
- 単体テスト **80 ケース**（IPv4/IPv6 拒否レンジ網羅、リダイレクトバイパス、サイズ超過、スキーム拒否、複数 A レコード混在、IPv6 hex mapped、DNS rebinding 遮断シナリオ）

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

- [ ] `docs/spec.md` の §6（スキーマ）と `packages/shared/src/*/schema.ts` が対応している
- [ ] `apps/studio/schemas/*.ts` は **Sanity 固有の表現**（reference / flat AI fields）を使う。GROQ projection で shared Zod 形（`*Refs` 文字列 / `aiMeta` ネスト）に橋渡しする設計（v0.1.5 #86 で明確化）。`apps/web/src/lib/ai/prompts/query-build.ts` の projection と `packages/shared/src/property/schema.ts` の `propertySchema` が整合しているか
- [ ] 禁止事項（`CLAUDE.md` 末尾）に違反していない:
  - localStorage / sessionStorage 不使用
  - 認証実装なし
  - 課金実装なし
  - クライアント情報・実在企業名なし

### 2. AI 連携の安全性

- [ ] `/api/query-build` は `searchCriteriaSchema` で入力検証、`buildPropertyGroq` がホワイトリスト方式
  → 不正な ref / city / 長すぎる値は `GroqInjectionError` で 400
- [ ] `/api/ingest-url` は `fetchHtmlSafe` 経由で per-hop に 全 A/AAAA → IP 検証 + undici Agent で検証済み IP に接続をピン留め（v0.1.1 + v0.1.3）
- [ ] `/api/chat-search` は Claude 出力を `searchCriteriaSchema.safeParse()` で再バリデーション（v0.1.2）
- [ ] SSE エラーは `sanitizeErrorForClient` で定型文に丸める（v0.1.2）
- [ ] Claude API キー未設定時は 503 で親切なメッセージ
- [ ] プロンプトに秘密情報・実在企業名が埋め込まれていない
- [ ] HTML 抽出は 12,000 文字でトリム（DoS 対策）

### 3. テストと CI

- [ ] Vitest: `apps/web/tests/` と `apps/web/src/**/__tests__/` を `vitest.config.ts` で拾えている
- [ ] shared 135 / web **160** / pytest 40 / Playwright 5 シナリオ × 2 ブラウザ
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
- [ ] [CHANGELOG.md](../CHANGELOG.md): v0.1.0 〜 v0.1.5 全て記載
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
| 500 応答の `details: message` 情報漏洩 | 削除し `console.error` のみに | v0.1.1 / #54 |
| SSE エラー `error.message` 露出 | `sanitizeErrorForClient` で定型文化 | v0.1.2 / #55 |
| ChatPanel 自動スクロールが効かない | useEffect 依存配列を修正 | v0.1.2 / #56 |
| chat-search の Claude 出力が未検証 | `searchCriteriaSchema.safeParse()` を強制 | v0.1.2 / #57 |
| **DNS リバインディング (TOCTOU)** | `undici` Agent の `connect.lookup` で検証済み IP に接続をピン留め | **v0.1.3 / #63** |
| **複数 A/AAAA の片方バイパス** | `dns.lookup({ all: true })` で全 IP を検証 | **v0.1.3 / #63** |
| **IPv6 16進 IPv4-mapped 取りこぼし** | ドット形式と 16 進形式を両方展開して再検査 | **v0.1.3 / #64** |
| **IPv6 blocklist の構造的弱さ** | `2000::/3` allowlist + 内部 block の二段構えに変更 | **v0.1.3 / #64** |
| IPv6 短縮形（`fc0:` 等）取りこぼし懸念 | allowlist 化で自動解決（`2000::/3` 外はすべて拒否） | v0.1.3 / #64 |
| **DNS ピン留め lookup 配列形式リグレッション** | `cb(null, [{address, family}])` に修正、実 undici 結合テスト追加 | **v0.1.4 / #81** |
| **モック専用テストで dispatcher 経路が一切未検証だった構造的穴** | `url-safety.integration.test.ts` で実 undici + ローカル HTTP サーバ結合テスト | **v0.1.4 / #81** |
| **結合テスト 3 本目の dead assertion (`Symbol.for(...)` が undefined)** | `pinnedLookup` を純関数として export し、Agent 内部に依存せず直接アサート | **v0.1.5 / #85** |
| **shared Zod ↔ Sanity の表現差（v0.2.0 ブロッカー）** | GROQ projection で `*Refs` / `aiMeta` ネストへ橋渡し、テストで契約ロック | **v0.1.5 / #86** |
| **坪数の二重管理 (GROQ raw vs JS rounded)** | GROQ から `tsubo` 撤去、`derivePropertyTsubo` を単一真実化 | **v0.1.5 / #87** |
| **fetchHtmlSafe 組み立て全体が実 undici 未検証** | リジェクト経路 3 件を node 環境で結合テスト | **v0.1.5 / #88** |
| `escapeString` の妥当性議論 | パラメータ化で注入遮断済、二重防御として残置で合意 | discussion |
| SSE 境界判定 `buffer.split("\n\n")` | 仕様通りで適切と合意 | discussion |
| `aiExtractionMetaSchema.superRefine` の相互制約 | 現状で十分と合意 | discussion |
| `searchCriteriaSchema` の片側のみ指定ケース | superRefine が両方 `!== undefined` で発火する仕様で問題なし | discussion |
| `parseClaudeCriteriaResponse` の最小ペイロード | 全フィールド optional で UX バランス良好と合意 | discussion |
| `propertySchema.parse(draftWithDefaults)` の安全性 | `.strict()` で余剰キーを弾く前提で問題なし | discussion |

## 重点的に見てほしい / 議論したい箇所（v0.1.3 時点）

過去のレビュー指摘 6 件は全て上の表で消化済み。今回は **新規の観点** で:

### 既知の残課題（Issue 起票済、v0.2.0 backlog）

- [#65](https://github.com/OceansCreative/oceans-tenant-demo/issues/65) **`apps/web/next.config.ts`** の `webpack.resolve.extensionAlias` — Turbopack 移行時に壊れる。`turbopack.resolveAlias` 二重化が未対応
- [#66](https://github.com/OceansCreative/oceans-tenant-demo/issues/66) **Python `sanity_client.py`** — `timeout=60` は設定済だがリトライ・バックオフ・429 ハンドリング・チャンク分割が未実装
- [#82](https://github.com/OceansCreative/oceans-tenant-demo/issues/82) **`/api/chat-search`** — クライアント切断時に `client.messages.create` を中断しない（signal 未伝播）

### 新規深掘り候補

1. **`apps/web/src/lib/ai/url-safety.ts:buildPinnedDispatcher`** — `undici` の `Agent({ connect: { lookup } })` は HTTPS の SNI を hostname のまま保つが、HSTS preload / 証明書ピンニング等の高度なクライアント検証要件下でも妥当か。テストはモック fetchImpl なので、実 undici 経路での挙動は未検証
2. **`fetchHtmlSafe` の Agent ライフサイクル** — 各ホップで Agent を `close()` しているが、`.catch(() => {})` でエラーを握りつぶす設計。実 undici で connection pool が残るケースがないか
3. **`assertPublicIp` の戻り値** — 全 IP を検証して **先頭** を返す方針。Happy Eyeballs (RFC 8305) 的に IPv6 優先で 2 番目を選ぶべきケースがないか（パフォーマンス影響）
4. **`packages/shared` の `SearchCriteria` 型マッピング** — `ReadonlyArray` への変換を Conditional Type で実現しているが、Zod が将来 `.readonly()` を正規提供したら整理可能
5. **`/api/chat-search` の SSE 接続切断** — クライアント側 `EventSource.close()` 時、サーバー側 `controller.close()` が確実に呼ばれるか（Anthropic API call 途中で AbortError → catch でストリームを閉じる経路の確認）
6. **`docs/AI_INTEGRATION.md` の脅威モデル明文化** — 現状は対策の羅列。攻撃者モデル（外部攻撃者 / 悪意あるユーザー入力 / 攻撃的な権威 DNS / ...）と各対策の対応関係を表で示せると良い

### Dependabot PR 状況

- **PR #75（undici 6 → 8）は close 済**: v0.1.3 で意図的に v6 pinned（jsdom 互換）
- 他 11 件は要 triage。`@types/node 20 → 25` / `vitest 2 → 4` / `happy-dom 15 → 20` 等は major、要動作確認

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
