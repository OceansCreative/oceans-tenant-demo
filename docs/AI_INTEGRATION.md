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

- ホスト名を DNS 解決し、得られた IP がインターネット公開レンジに含まれることを確認
- 拒否レンジ（IPv4）: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`,
  `169.254.0.0/16`（クラウドメタデータ）, `172.16.0.0/12`, `192.0.0.0/24`,
  `192.0.2.0/24`, `192.88.99.0/24`, `192.168.0.0/16`, `198.18.0.0/15`,
  `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `255.255.255.255/32`, `240.0.0.0/4`
- 拒否レンジ（IPv6）: `::1`, `::`, `fc00::/7` (ULA), `fe80::/10` (link-local),
  `ff00::/8` (multicast), `100::/64` (discard), `2001:db8::/32` (documentation),
  IPv4-mapped IPv6 で埋め込まれた IPv4 も再検査
- `redirect: "manual"` で per-hop に上記検証を実施（最大 3 ホップ）
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
