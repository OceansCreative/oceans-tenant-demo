# AI 連携設計

OceansTenant の AI レイヤ（Claude API 活用）の設計をまとめます。

## アーキテクチャ概要

```mermaid
flowchart LR
  user[ユーザー] -->|URL| ingest[/api/ingest-url/]
  user -->|自然言語| chat[/api/chat-search/]
  ingest -->|fetch HTML| upstream[掲載元サイト]
  ingest -->|Readability| extract[本文抽出]
  extract -->|prompt| claude1[Claude<br/>messages.create]
  claude1 -->|JSON| zod1[Zod 検証]
  zod1 -->|draft| sanity[Sanity Draft]
  chat -->|messages history| claude2[Claude<br/>streaming]
  claude2 -->|criteria JSON| qb[/api/query-build/]
  qb -->|GROQ| sanity
  sanity -->|properties[]| chat
```

## API レイヤ

### `POST /api/ingest-url`

**役割**: 物件掲載 URL から構造化された Property を抽出する。

**フロー**:
1. リクエスト検証（`url` のスキーマと http(s) チェック）
2. `fetch(url)` で HTML 取得（タイムアウト 12 秒、Bot User-Agent）
3. `extractReadableContent()` で Mozilla Readability + Cheerio fallback
4. Claude `messages.create()` で JSON 抽出（システムプロンプトに厳守事項）
5. 応答テキスト → `JSON.parse`（コードフェンス除去）→ `propertySchema.parse()` で Zod 検証
6. `derivePropertyTsubo()` で坪数を計算
7. レスポンス: `{ status: "ok", draft, confidence }`

**プロンプト**: [`extract-property.ts`](../apps/web/src/lib/ai/prompts/extract-property.ts)

**エラーハンドリング**:

| ケース | ステータス | 対応 |
|---|---|---|
| URL 形式不正 | 400 | 早期 return |
| SSRF 防御で拒否 (内部レンジ) | 400 | `SsrfDeniedError` → 定型文のみ返す |
| 不正な URL スキーム | 400 | `FetchSafetyError(invalid_scheme)` |
| 本文抽出失敗 | 422 | text < 50 もしくは upstream 4xx |
| 応答サイズ上限超過 (5MB) | 413 | `FetchSafetyError(size_exceeded)` |
| リダイレクト 3 ホップ超過 | 421 | `FetchSafetyError(too_many_redirects)` |
| リダイレクト Location 欠落 | 502 | `FetchSafetyError(invalid_redirect)` |
| AI 応答にテキストなし | 502 | content blocks に text なし |
| Claude API 未設定 | 503 | "ANTHROPIC_API_KEY" を含むメッセージ |
| Claude タイムアウト | 504 | abort signal |
| Zod 検証失敗 / その他 | 500 | クライアントには定型文、詳細は `console.error` |

**SSRF 防御**（[`apps/web/src/lib/ai/url-safety.ts`](../apps/web/src/lib/ai/url-safety.ts)）:

ホスト名を `dns.lookup(host, { all: true })` で **全 A/AAAA** を取得し、すべての IP がインターネット公開レンジに含まれることを `node:net` の `BlockList` で確認する。複数応答で片方だけ public を混ぜる手口を遮断する。

- **IPv4 拒否レンジ**（17 サブネット、blocklist 方式）: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`（クラウドメタデータ）, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.88.99.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `255.255.255.255/32`, `240.0.0.0/4`
- **IPv6 はアロウリスト方式**: `2000::/3`（グローバルユニキャスト）のみ通過。それ以外（`::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `100::/64`, その他 reserved すべて）は自動的に拒否
  - `2000::/3` 内でも `2001:db8::/32`（documentation）/ `2001::/32`（Teredo）/ `2002::/16`（6to4）は拒否
  - IPv4-mapped IPv6 は **ドット表記と 16 進表記の両形式** で IPv4 に展開し、private IPv4 が埋め込まれていれば拒否。さらに IPv4-mapped IPv6 自体を攻撃面最小化のため一律拒否
- `redirect: "manual"` で per-hop に上記検証を実施（最大 3 ホップ）

**DNS リバインディング (TOCTOU) 遮断**:

`assertPublicIp` が返した検証済み IP を `undici` の `Agent({ connect: { lookup } })` に焼き込み、各ホップの `fetch` を強制的にその IP へ接続する。これにより「検証時は public・接続時は private」になる攻撃を遮断する。HTTPS の SNI / 証明書検証は元の hostname を維持するため、IP リテラルへの URL 書き換えは行わず、dispatcher 経由で接続先のみピン留めする。

- レスポンスは `Content-Length` 早期検査 + ストリーミングで 5MB を超えたら abort
- タイムアウトは 12 秒
- 500 応答に内部エラー詳細を載せない（`console.error` のみ）

### `POST /api/query-build`（内部 API）

**役割**: 構造化条件 → Sanity GROQ クエリへの**決定論的**変換。AI は介さない。

**ホワイトリスト方式によるインジェクション防止**:
- 都道府県は `prefectureValues` に一致するもののみ
- 建物形態 / 物件状態 は enum 値のみ
- `businessCategoryRefs` は `/^[a-zA-Z0-9_-]{1,80}$/` のみ
- 不正な値は `GroqInjectionError` で 400 を返す

**GROQ パラメータ**: `$prefecture`, `$minRent` などのパラメータ化で値はクエリ文字列に埋め込まない。

### `POST /api/chat-search`（SSE）

**役割**: 対話履歴 → 検索条件抽出 → 結果配信を SSE でストリーミング。

**SSE イベント形式**:

```ts
type SseEvent =
  | { type: "criteria"; criteria: SearchCriteria }
  | { type: "message"; content: string }
  | { type: "results"; properties: PropertyWithTsubo[] }
  | { type: "done" }
  | { type: "error"; error: string };
```

クライアントは `EventSource` または `ReadableStream` で読み取り、UI を逐次更新する。

### Claude 出力の再バリデーション原則

Claude が返した `extractedCriteria` は、`packages/shared/src/searchCriteria/schema.ts` の `searchCriteriaSchema.safeParse()` を **必ず** 通してから後続経路（`filterProperties` や将来の GROQ 生成）に流す。

- 列挙値違反（未知の都道府県・建物形態・物件状態など）は拒否
- 範囲違反（`minRent > maxRent`、`minArea > maxArea`）は superRefine で拒否
- `businessCategoryRefs` の不正な ID は正規表現で拒否
- 失敗時はサーバー側 `console.error` でログ、クライアントには現状条件維持 + 「条件の更新ができませんでした」を返す

同じ `searchCriteriaSchema` を `/api/query-build` のリクエスト検証にも使うことで、GROQ レイヤに到達する前にホワイトリスト検証が二重に効く。

### SSE エラーメッセージのサニタイズ

`/api/chat-search` の catch ブロックは `sanitizeErrorForClient()` を通して定型文に丸める。

| 入力 | クライアントへの応答 |
|---|---|
| 一般 Error（SDK 内部 / 通信失敗 / 想定外） | 「処理中にエラーが発生しました。時間をおいて再度お試しください。」 |
| `ANTHROPIC_API_KEY` を含むメッセージ | そのまま透過（運用者向けの設定案内として有効） |

詳細はサーバー側 `console.error` のみに残し、SDK スタック断片等が SSE 経由で漏れないようにする。

## Zod ⇄ Claude tool use の対応

現状は Claude の通常の messages API で JSON を返させる方式を採用しています。
将来的に Claude の Tool Use 機能で `propertySchema` を JSON Schema として渡すリファクタを検討します。

| Zod スキーマ | Tool Use の input_schema |
|---|---|
| `propertySchema` | `extract_property` ツールの `input_schema` |
| `extractedSearchCriteriaSchema` | `update_criteria` ツールの `input_schema` |

## レート制限への対処

Claude API は 429 を返すことがあります。本実装では:

- フロント側: 「考えています…」表示中の重複送信を `pending` で抑制
- API 側: 失敗時にエラー JSON を返し、UI でユーザーに通知
- 将来: exponential backoff + 内部キュー（Phase 5 以降）

## モックとテスト

- `apps/web/src/lib/ai/prompts/*.ts` は pure 関数で snapshot テスト
- API ルートの統合テストは `getAnthropicClient()` を `setAnthropicClientForTesting()` で差し替え
- E2E では NEXT_PUBLIC_GOOGLE_MAPS_API_KEY / ANTHROPIC_API_KEY 未設定でもクラッシュしないよう、UI 側でフォールバックを用意

## 開発時の注意

- **秘密情報をプロンプト本文に含めないこと**。`extractedHtmlText` は最大 12,000 文字でトリム
- **本物の URL を本リポジトリのドキュメント / テストに固定しないこと**（spec の禁止事項）
- **ストリーミング応答の早期終了**を許容できる設計にする（ユーザーが画面を離れたら中止する未来想定）
