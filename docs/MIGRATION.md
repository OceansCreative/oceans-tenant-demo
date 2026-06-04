# Migration Guide

OceansTenant のメジャー / マイナーバージョン間で発生した互換性影響と、移行に必要な対応をまとめます。

リリース履歴の詳細は [CHANGELOG.md](../CHANGELOG.md) を、ロードマップは [docs/ROADMAP.md](./ROADMAP.md) を参照してください。

---

## 1. Migration ポリシー

本リポジトリは [Semantic Versioning](https://semver.org/lang/ja/) に準拠します。

| バージョン段 | 破壊的変更 | 互換性 |
|---|---|---|
| MAJOR（例: `1.0.0` → `2.0.0`） | 許容 | API / スキーマ / env / CLI に破壊的変更が入る可能性。本ドキュメントで個別に案内 |
| MINOR（例: `0.8.0` → `0.9.0`） | **原則禁止だが、`0.x` の間は限定的に許容** | 公開 API（`packages/shared/src/index.ts` の export 等）の追加・拡張のみが原則。`0.x` 系列では UI Props や内部実装の破壊的変更が混在することを許容するが、本ドキュメントに必ず記載する |
| PATCH（例: `0.9.0` → `0.9.1`） | 禁止 | バグ修正・ドキュメント・依存更新のみ |

`0.x` 系列の特性として、UI Props の API 変更は MINOR でも発生し得ます（例: v0.9.0 の `SearchPagination`）。
v1.0.0 以降は本格的に互換性を維持し、破壊的変更は MAJOR でのみ行います。

---

## 2. v0.x → v1.0.0（予定）

v1.0.0 は v0.9.0 までの累積を初の安定リリースとしてタグ付けする位置付けです。
v0.x 系列の途中で発生した既知の破壊的変更を以下に集約します。新規導入時は最初から v1.0.0 互換で書けば問題ありません。

### 2.1 SearchPagination の API 変更（v0.9.0 で発生）

i18n フェーズ 2（PR #126）に伴い、`SearchPagination` を Client Component 化したため、関数 prop を配列 prop に置き換えました。

| | v0.8.0 まで | v0.9.0 以降 |
|---|---|---|
| Prop 名 | `buildHref` | `hrefs` |
| 型 | `(page: number) => string` | `[page: number, href: string][]` |
| 理由 | Client Component は関数 prop を serialize できないため、サーバ側で href を組み立てた結果を配列で渡す |

移行例:

```tsx
// Before（v0.8.0）
<SearchPagination
  currentPage={page}
  totalPages={totalPages}
  buildHref={(p) => `/search?${new URLSearchParams({ ...params, page: String(p) })}`}
/>

// After（v0.9.0+）
const hrefs: [number, string][] = pages.map((p) => [
  p,
  `/search?${new URLSearchParams({ ...params, page: String(p) })}`,
]);
<SearchPagination currentPage={page} totalPages={totalPages} hrefs={hrefs} />
```

ページ番号生成ロジックは `lib/pagination.ts` の `computeVisiblePages` に切り出し済みなので、server / client 双方から呼べます。

### 2.2 enum 翻訳 helper の導入（v0.9.0 で発生）

物件の建物形態 / 物件状態 / availability ラベルは v0.8.0 まではコンポーネント内でハードコードされていました。
v0.9.0 で `lib/i18n/enum-labels.ts` を新設し、`useEnumLabelLookup()`（Client）/ `createEnumLabelLookupAsync()`（Server）経由で取得する方式に統一しました。

```tsx
// Before（v0.8.0）
<span>{property.buildingType === "skeleton" ? "スケルトン" : "造作譲渡"}</span>

// After（v0.9.0+）
const enumLabels = useEnumLabelLookup();
<span>{enumLabels.buildingType(property.buildingType)}</span>
```

Storybook やテストでは `NextIntlClientProvider` でラップが必要です（`renderWithI18n` helper 使用）。

### 2.3 Property の `aiMeta` ネスト化（v0.5.0 で発生）

AI 抽出に関するメタデータ（信頼度 / 抽出時刻 / 抽出元 URL 等）を `aiMeta` オブジェクトに集約しました。

```ts
// Before（v0.4.0 まで）
property.aiExtractedAt
property.aiConfidence
property.aiSourceUrl

// After（v0.5.0+）
property.aiMeta?.extractedAt
property.aiMeta?.confidence
property.aiMeta?.sourceUrl
```

Sanity ドキュメントのスキーマ変更を伴うため、既存データの再 seed が必要です。`scripts/python/seed_properties.py` は新形式に対応済みです。

### 2.4 searchCriteriaSchema の拡張（v0.2.0 で発生）

ページネーション導入（v0.2.0）に伴い、`packages/shared/src/schemas/search.ts` の `searchCriteriaSchema` に以下のフィールドが追加されました。

| フィールド | 型 | 既定値 |
|---|---|---|
| `page` | `number().int().min(1)` | `1` |
| `pageSize` | `number().int().min(1).max(100)` | `12` |

クライアント側で `searchCriteriaSchema.parse()` を呼ぶ場合、未指定でも既定値が補われるため後方互換です。
ただし型レベルでは `page` / `pageSize` がオプショナルから必須に近い扱いになっているため、`as const` や `satisfies` で型注釈している箇所は要確認です。

### 2.5 SANITY_API_READ_TOKEN の追加（v0.4.0 で発生）

Sanity 実接続レイヤ（v0.4.0）で、`getSanityClient` が `SANITY_API_READ_TOKEN` を参照するようになりました。
未設定の場合は **mock fallback** で動作するため、ローカル開発では引き続き無設定で動きます。

`SANITY_API_TOKEN`（書き込み用）と `SANITY_API_READ_TOKEN`（読み取り用）の使い分けは以下の通りです:

| 変数 | 用途 | 権限 |
|---|---|---|
| `SANITY_API_TOKEN` | `/api/ingest-url` でドラフト保存（書き込み） | Editor |
| `SANITY_API_READ_TOKEN` | `getSanityClient()` での GROQ 読み取り | Viewer |

詳細は [.env.example](../.env.example) と [docs/AI_INTEGRATION.md](./AI_INTEGRATION.md) を参照。

---

## 3. 環境変数の変更履歴

`.env.example` の変遷を追跡します。v1.0.0 リリース後は本セクションに追記してください。

### 追加された env

| 変数 | 導入 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | v0.1.0 | Sanity プロジェクト ID（必須） |
| `NEXT_PUBLIC_SANITY_DATASET` | v0.1.0 | Sanity データセット（必須） |
| `SANITY_API_TOKEN` | v0.1.0 | Sanity 書き込みトークン（任意。未設定なら mock fallback） |
| `ANTHROPIC_API_KEY` | v0.1.0 | Claude API キー（任意。未設定なら mock fallback） |
| `ANTHROPIC_MODEL` | v0.1.0 | Claude モデル名（既定 `claude-sonnet-4-5`） |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | v0.1.0 | Google Maps API キー（未設定時は地図無効化） |
| `NEXT_PUBLIC_APP_URL` | v0.1.0 | OG / canonical 用 |
| `OCEANS_BASEPATH` | v0.4.0 | `/tenant-search` 等の basePath（任意） |
| `SANITY_API_READ_TOKEN` | v0.4.0 | Sanity 読み取りトークン（任意。Viewer 権限） |
| `EVAL_SCORE_THRESHOLD` | v0.9.0 | eval CI の品質ゲートしきい値（既定 `0.6`） |
| `PLAYWRIGHT_PORT` / `PLAYWRIGHT_BASE_URL` | v0.5.0 | Playwright のポート / ベース URL 上書き |

### 廃止された env

v0.9.0 時点では廃止された env はありません。

---

## 4. API スキーマの変更履歴

`packages/shared/src/schemas/*.ts` の Zod スキーマで発生した非互換変更を集約します。

| 変更 | 導入バージョン | 影響範囲 |
|---|---|---|
| `searchCriteriaSchema` に `page` / `pageSize` 追加 | v0.2.0 | `/search` の URL クエリ、`/api/query-build` の入力 |
| `propertySchema` の `aiMeta` ネスト化 | v0.5.0 | `/api/ingest-url` の出力、Sanity Property ドキュメント |
| `chatSearchRequestSchema` に `sessionId` 追加 | v0.6.0 | `/api/chat-search` の入力（SSE 連携の session 識別子） |
| `propertySchema.availability` の enum 拡張 | v0.7.0 | UI 表示・ダミーデータ生成 |

GROQ クエリ側の変更は [docs/ARCHITECTURE.md](./ARCHITECTURE.md) のデータフロー章を参照してください。

---

## 5. 既知の制約

v1.0.0 時点で、本リポジトリには以下の制約があります。本番ワークロード向けに利用する場合は事前に検討してください。

### 5.1 in-memory レート制限

`/api/ingest-url` / `/api/chat-search` 等のレート制限は in-memory Map で実装されているため、**Vercel サーバレス上では各インスタンスで独立** します。
本番運用前提では Upstash Redis 等の外部ストアへの置換を推奨します（v1.x の検討項目）。

### 5.2 Web Vitals store の永続化

Web Vitals は in-memory ring buffer に蓄積されるため、サーバレス各インスタンスで独立し、再起動で消失します。
永続化には Vercel KV / Upstash Redis 等が必要です（v1.x の検討項目）。

### 5.3 Sanity の多言語

現状、Sanity ドキュメントは日本語ベースで管理されており、UI 側の locale 切替（next-intl）と連動していません。
建物種別ラベル等は `lib/i18n/enum-labels.ts` で UI 側 enum マップによって切替されていますが、自由記述フィールド（説明文 / アクセス情報）は ja のままです。
v1.x で Sanity 側多言語スキーマ（`__i18n_lang` 等の Sanity Internationalization Plugin 採用）を検討します。

### 5.4 認証なし demo

[CLAUDE.md](../CLAUDE.md) の方針により、本リポジトリは認証を実装しません。
`/agent` ポータルは feature flag で有効化される demo であり、本番ワークロードでは適切な認証層を別途追加してください。

### 5.5 admin UI の feature flag 制

`/agent` / `/studio` / `/insights` は OSS デモ用に常時公開していますが、本番想定では認証保護下に置く前提です。
`OCEANS_ENABLE_AGENT` 等の feature flag で無効化できます。

---

## 6. 移行手順テンプレート（v1.x → v2.0 等）

将来のメジャーアップグレード時に本ドキュメントに追記する場合のテンプレートです。

```markdown
## N. vX.Y → vA.B

### 必須対応

1. 〇〇 を△△ に変更
2. △△ env を新設

### 推奨対応

1. ...

### 自動移行スクリプト

`pnpm migrate:vA.B` で codemod を実行できます（提供する場合）。

### ロールバック

`git revert` で元バージョンの動作に戻せます。Sanity スキーマの変更を含む場合は、データセットの snapshot 復元が必要です。
```

---

## 7. 関連ドキュメント

- [docs/ROADMAP.md](./ROADMAP.md) — v1.0.0 マイルストーンと v1.x 以降の構想
- [CHANGELOG.md](../CHANGELOG.md) — リリースごとの全変更履歴
- [docs/spec.md](./spec.md) — 仕様書
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — アーキテクチャと主要ライブラリ
- [docs/AI_INTEGRATION.md](./AI_INTEGRATION.md) — AI 連携と評価ハーネス
- [.env.example](../.env.example) — 環境変数テンプレート
