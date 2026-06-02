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
4. Claude `messages.create()` を `tools: [extractPropertyTool]` と
   `tool_choice: { type: "tool", name: "extract_property" }` で呼び出し
5. 応答の `tool_use` ブロックの `input` を `propertySchema.parse()` で Zod 検証
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
| AI 応答に tool_use なし | 502 | content blocks に `extract_property` の tool_use なし |
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

**lookup コールバックの形式（v0.1.4 で修正、Issue #81）**:

custom `lookup` は **配列形式** `cb(null, [{ address, family }])` を返す。Node 20+ では `net.createConnection` の `autoSelectFamily` が既定 true で、内部は Happy Eyeballs (RFC 8305) のため `[{address, family}, ...]` の配列を期待する。単一形式 `cb(null, ip, family)` は `ERR_INVALID_IP_ADDRESS` で接続前に弾かれる。

実 undici + ローカル HTTP サーバの結合テスト（`url-safety.integration.test.ts`）でこの形式が実機で動作することを保証する。モック `fetchImpl` のみの単体テストでは dispatcher 経路が一切実行されず、形式違反を検出できないため、結合テストは **必須** とする。

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

Claude が `update_criteria` ツールの `input.criteria` で返した検索条件は、
`packages/shared/src/searchCriteria/schema.ts` の `searchCriteriaSchema.safeParse()`
を **必ず** 通してから後続経路（`filterProperties` や将来の GROQ 生成）に流す。
Tool Use を使うことで構造そのものは Anthropic 側で保証されるが、列挙値違反や
`superRefine` のクロスフィールド検証は依然サーバー側で実施する必要がある。

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

## Zod ⇄ Claude Tool Use の対応（v0.2.0 で本格採用）

`/api/ingest-url` と `/api/chat-search` のいずれも、Claude の **Tool Use 機能** を
使って構造化応答を強制しています。Claude には自由記述テキストではなく必ず
ツール呼び出し（`tool_use` ブロック）を返してもらい、サーバー側はその `input`
を Zod スキーマで再バリデーションして後続処理に渡します。

**実装**: [`apps/web/src/lib/ai/tools.ts`](../apps/web/src/lib/ai/tools.ts)

```mermaid
flowchart LR
  zod[Zod スキーマ] -->|zod-to-json-schema| jsonschema[JSON Schema]
  jsonschema --> tool[Anthropic Tool 定義]
  tool -->|messages.create<br/>tools: [...]| claude[Claude]
  claude -->|tool_use ブロック<br/>input: 構造化 object| server[Server]
  server -->|safeParse| zod
```

| Zod スキーマ | ツール名 | 利用 API | 説明 |
|---|---|---|---|
| `propertySchema` | `extract_property` | `/api/ingest-url` | HTML 本文から物件情報を構造化抽出 |
| `searchCriteriaSchema` | `update_criteria` | `/api/chat-search` | ユーザー発話から検索条件を抽出（`message` フィールドに対話応答も同梱） |

**Tool Use のメリット**:

- 自由記述出力（` ```json ` で囲まれた / 囲まれていない JSON が混在する）の
  パースぶれを排除。Claude 側の API 仕様で構造化が保証される
- `tool_choice: { type: "tool", name: ... }` で **必ず** そのツールを呼ばせるため、
  「JSON 以外の出力をしないこと」とプロンプトで指示するより堅牢
- `input_schema` を Anthropic 側にも渡せるため、Claude が事前にスキーマを
  考慮した生成を行いやすい（列挙値・enum の遵守率が向上）
- Zod → JSON Schema は [`zod-to-json-schema`](https://github.com/StefanTerdell/zod-to-json-schema) で
  単一真実から自動生成。**スキーマ二重管理を回避**できる

**サーバー側の防御**:

ツール経由でも列挙値違反や `superRefine` のクロスフィールド検証は起こり得るため、
`tool_use.input` を必ず `safeParse` に通す。失敗時は fallback（現条件維持 + 定型文）。

**`update_criteria` ツールの input 仕様**:

```ts
{
  message: string;             // 必須。ユーザー向け 1〜2 文
  criteria?: SearchCriteria;   // 任意。省略 / null は「条件は変えない」
}
```

`criteria` を省略可能にしているのは、Claude が「もう少し詳しく教えてください」
のように条件抽出を保留して質問だけ返すケースを許容するため。

## クライアント切断時の Anthropic 呼び出し中断（Issue #82）

`/api/chat-search` の `POST` ハンドラは、`request.signal` をそのまま
`client.messages.create(args, { signal })` の第 2 引数に伝搬し、Anthropic SDK の
リクエストを中断できるようにしています。さらに `ReadableStream` の `start`
内で `signal` の `abort` イベントを購読し、発火時は `controller.close()` で
SSE ストリームを閉じます。abort 由来の例外（`APIUserAbortError` / `AbortError` /
メッセージに `abort` を含むエラー）は SSE `error` イベントを流さず静かに終了します。

これにより、ユーザーがブラウザタブを閉じた / ページ遷移したケースで、
無駄に Anthropic 課金トークンを消費し続けることを防ぎます。

## レート制限（in-memory token bucket、v0.5.0 WS-1）

OSS デモを公開した際の **DoS 緩和** と **Anthropic API コストの暴発予防** を目的に、
`/api/chat-search` と `/api/ingest-url` に IP ベースの in-memory token bucket
レート制限を導入しています。

実装は [`apps/web/src/lib/rate-limit.ts`](../apps/web/src/lib/rate-limit.ts) と
[`apps/web/src/lib/get-client-ip.ts`](../apps/web/src/lib/get-client-ip.ts) を参照。

### 設計概要

- **キー**: `${client_ip}::${endpoint}`（エンドポイント単位の独立バケット）
- **クライアント IP**: `x-forwarded-for` の最左 → `x-real-ip` → `host` の順
  にフォールバック。`node:net.isIP` で形式検証し不正値は `unknown` に倒す
- **補充**: lazy refill（呼び出し時に経過時間から算出）。cron 不要
- **メモリ上限**: 1000 エントリを超えたら挿入順 = 概ね LRU 順の先頭を削除

### 既定値

| エンドポイント | 容量 (burst) | 補充間隔 | 持続レート |
|---|---|---|---|
| `/api/chat-search` | 20 | 6 sec / 1 token | 10 req/min |
| `/api/ingest-url` | 10 | 12 sec / 1 token | 5 req/min |

`ingest-url` は AI コスト（HTML 抽出 + Tool Use）が高いため、`chat-search` よりも
持続レートを半分程度に抑えています。

### 環境変数による上書き

| 変数 | 既定 |
|---|---|
| `RATE_LIMIT_CHAT_CAPACITY` | 20 |
| `RATE_LIMIT_CHAT_REFILL_INTERVAL_MS` | 6000 |
| `RATE_LIMIT_INGEST_CAPACITY` | 10 |
| `RATE_LIMIT_INGEST_REFILL_INTERVAL_MS` | 12000 |

不正値（数値変換失敗 / 0 以下）は無視され既定値に倒れます。

### レスポンス仕様

**許可時**: ヘッダ `X-RateLimit-Limit` / `X-RateLimit-Remaining` /
`X-RateLimit-Reset`（バケットが満タンになる Unix 時刻、秒）を付与。
SSE エンドポイントでもこれらは Response ヘッダに含まれます。

**拒否時**: HTTP 429、ヘッダ `Retry-After: <seconds>`、JSON body
`{ error: "rate_limited", retryAfterSeconds: N }`。SSE エンドポイントでも
ストリーム開始前に判定し、通常 JSON で返します。

### サーバレス環境での重要な制約

**本実装は同一 Node プロセスのメモリ内にバケットを保持** します。
Vercel のような serverless 環境では:

- リージョン / インスタンスごとに独立したバケットを持つ
- インスタンスがコールドスタートするたびにバケットがリセットされる
- 結果として「実効レート > 設定値」になる可能性がある

OSS デモ用としては十分な防御層ですが、本番運用で厳密な集中制御が必要な場合は
Upstash Redis / Cloudflare KV / Vercel KV など共有ストアに置き換えてください。
`consumeRateLimit` のインタフェースは集中ストアにも拡張しやすいシグネチャ
にしてあります。

### Claude API 自体の 429

Claude API 側の 429（Anthropic のレート制限）への対処は別レイヤです:

- フロント側: 「考えています…」表示中の重複送信を `pending` で抑制
- API 側: 失敗時にエラー JSON を返し、UI でユーザーに通知
- 将来: exponential backoff + 内部キュー（Phase 5 以降）

## 抽出評価（`scripts/eval/`、v0.8.0 WS-2）

`extract_property` の抽出精度を Gold Standard データセットで継続的に測るためのハーネスを
`scripts/eval/` に同梱しています。LLM 連携の品質を **数値で評価する** OSS リファレンスとして整備しました。

### 構成

| ファイル | 役割 |
|---|---|
| `scripts/eval/run.mjs` | CLI エントリポイント。`--mock` で API キー不要のスモーク実行 |
| `scripts/eval/extract.mjs` | Claude SDK（実 / モック）の呼び出しを抽象化 |
| `scripts/eval/metrics.mjs` | precision / recall / F1 / フィールド別スコアの純粋関数群 |
| `scripts/eval/mock-anthropic.mjs` | API キーなしでもハーネスを回せるモッククライアント |
| `scripts/eval/report.mjs` | Markdown / JSON レポート整形 |
| `scripts/eval/fixtures/` | 5 件の架空物件 HTML + 期待 JSON |

### メトリクス

| カテゴリ | フィールド | 比較方法 |
|---|---|---|
| 数値 | `rent` | 完全一致 |
| 数値（許容範囲） | `area` | ±1 ㎡ |
| 厳密一致 | `address.prefecture` / `address.city` / `buildingType` / `condition` / `floor` | 厳密一致 |
| 自由テキスト | `title` / `description` | Sørensen–Dice 係数（バイグラム） |
| 配列 | `suitableBusinessRefs` / `features` | Jaccard 類似度 |
| 駅配列 | `nearestStations` | 路線+駅名で正規化後 Jaccard |

全体スコアは `FIELD_WEIGHTS` による重み付き平均。precision / recall / F1 は
「expected/actual の双方にフィールドが存在し、かつ matched」を true positive として集計。

### 実行コマンド

```bash
# モック実行（API キー不要、ハーネスのスモーク確認）
pnpm --filter oceans-tenant-eval run eval:mock

# 実 Claude 実行
ANTHROPIC_API_KEY=sk-ant-... node scripts/eval/run.mjs

# メトリクスのユニットテスト
pnpm --filter oceans-tenant-eval test
```

詳細と fixture 追加手順は [`scripts/eval/README.md`](../scripts/eval/README.md) を参照。

### CI 統合方針

実 Claude 呼び出しを伴うため CI には常時組み込まず、将来的に PR ラベル `eval` 付与時 / 週次 cron での
実行を想定（本リリースではコマンド整備のみ）。

## モックとテスト

- `apps/web/src/lib/ai/prompts/*.ts` は pure 関数で snapshot テスト
- API ルートの統合テストは `getAnthropicClient()` を `setAnthropicClientForTesting()` で差し替え
- E2E では NEXT_PUBLIC_GOOGLE_MAPS_API_KEY / ANTHROPIC_API_KEY 未設定でもクラッシュしないよう、UI 側でフォールバックを用意

## 開発時の注意

- **秘密情報をプロンプト本文に含めないこと**。`extractedHtmlText` は最大 12,000 文字でトリム
- **本物の URL を本リポジトリのドキュメント / テストに固定しないこと**（spec の禁止事項）
- **ストリーミング応答の早期終了**を許容できる設計にする（`/api/chat-search` は
  `request.signal` を SDK に伝搬し、クライアント切断時に Anthropic 呼び出しを
  中断する — Issue #82）
