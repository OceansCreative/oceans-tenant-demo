# 抽出評価ハーネス（`scripts/eval/`）

`/api/ingest-url` で使う Claude Tool Use `extract_property` の **抽出精度** を
Gold Standard データセットで継続的に測るためのハーネスです。

「LLM 連携の品質を数値で評価する」OSS リファレンス実装として整備しています。

## 何ができるか

- 5 件の架空物件 HTML（fixtures）に対して Claude を呼び、`extract_property` の出力と
  期待 JSON を**フィールド単位**で比較
- precision / recall / F1 と全体スコア（重み付き平均）を Markdown でレポート
- 失敗フィールドは `expected` と `actual` を diff 形式で表示
- `--output-json` で機械可読な JSON も出力可能（CI 連携用）

## 実行方法

### モック実行（API キー不要）

ハーネス自体の動作確認用。fixture HTML から **期待 JSON を直接返す** モックを使うため、
スコアは "ほぼ満点"（features を 1 件落としてレポートに動きが出るようにしてあります）。

```bash
pnpm --filter oceans-tenant-eval run eval:mock
# あるいは
node scripts/eval/run.mjs --mock
```

### 実 Claude 実行

`ANTHROPIC_API_KEY` を設定すると本物の Claude に問い合わせて評価します。
1 fixture あたり数千トークンの入出力が発生するため、コストには留意してください
（sonnet 4.5 で概算 USD 数十セント / フル実行）。

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node scripts/eval/run.mjs
```

### JSON 出力

```bash
node scripts/eval/run.mjs --mock --output-json /tmp/eval-result.json
```

### ユニットテスト

メトリクス関数の純粋性検証のみを実行します（Claude 呼び出しは行いません）。

```bash
pnpm --filter oceans-tenant-eval test
# あるいは
node --test scripts/eval/__tests__/metrics.test.mjs
```

## メトリクス設計

| カテゴリ | 対象フィールド | 比較方法 |
|---|---|---|
| 数値 | `rent` | 完全一致 |
| 数値（許容範囲） | `area` | ±1 ㎡ 許容 |
| 文字列 | `address.prefecture` / `address.city` / `buildingType` / `condition` / `floor` | 厳密一致 |
| 自由テキスト | `title` / `description` | Sørensen–Dice 係数（バイグラム） |
| 配列 | `suitableBusinessRefs` / `features` | Jaccard 類似度 |
| 駅配列 | `nearestStations` | 路線+駅名で正規化後 Jaccard（`walkMinutes` のぶれは無視） |

全体スコアは `metrics.mjs` の `FIELD_WEIGHTS` で定義する重み付き平均。precision / recall / F1
は「フィールドが expected/actual の双方に存在し、かつ matched」を true positive として集計します。

## ファイル構成

```text
scripts/eval/
├─ run.mjs                   # CLI エントリポイント
├─ extract.mjs               # Claude 呼び出し（実 SDK / モック切替）
├─ metrics.mjs               # 純粋関数の評価ロジック
├─ mock-anthropic.mjs        # API キーなしでもハーネスが動くモック
├─ report.mjs                # Markdown / JSON レポート整形
├─ package.json              # oceans-tenant-eval ワークスペース
├─ __tests__/
│  └─ metrics.test.mjs       # node:test ベースのメトリクスユニットテスト
└─ fixtures/                 # Gold Standard（5 件、すべて完全架空物件）
   ├─ cafe-shibuya.{html,expected.json}
   ├─ restaurant-shinjuku.{html,expected.json}
   ├─ bar-roppongi.{html,expected.json}
   ├─ shop-omotesando.{html,expected.json}
   └─ office-marunouchi.{html,expected.json}
```

## fixture を追加するには

1. `fixtures/<id>.html` に架空物件の HTML を置く（150〜300 行程度を目安に、
   関係ないサイドナビ・フッタ・script 等のノイズも含めると評価精度が上がる）
2. `fixtures/<id>.expected.json` に `propertySchema` 互換の期待値を置く
   - `aiMeta` / `listedByRef` / `slug` 等の運用フィールドは省略可（評価対象外）
3. `pnpm --filter oceans-tenant-eval run eval:mock` で動作確認
4. **実在企業名・実在物件情報を含めないこと**（CLAUDE.md 禁止事項）

## CI 統合（v0.9.0〜）

`.github/workflows/eval.yml` で **PR ラベル `eval` 付与時** および **週次 cron** で
実 Claude を叩いて評価する仕組みを整備済みです（v0.9.0 WS-2 で追加）。

### 起動条件

| トリガ | 条件 | モード |
|---|---|---|
| `pull_request` (`labeled` / `synchronize`) | PR に `eval` ラベル付与 | 実 Claude |
| `schedule` | 毎週月曜 09:00 JST（cron `0 0 * * 1`） | 実 Claude |
| `workflow_dispatch` | 手動起動 | 実 Claude |

`ANTHROPIC_API_KEY` シークレットが未設定の場合は自動でモックモードにフォールバックします
（ハーネスが落ちないようにするため。精度評価としては無意味な点に注意）。

### コスト管理

- PR ラベル必須により誤起動を防止
- `concurrency` で同一 PR 上の同時実行を 1 本に制限
- `timeout-minutes: 5` でランナーを早期 abort
- 1 ジョブあたりの推定コスト: 5 fixtures × ~3000 tokens × Sonnet 4.5 ≒ **~$0.05**

### 品質ゲート

実 Claude 実行時、`aggregate.overallScore < 0.6` で CI を fail させます
（プロンプト変更や fixture 追加で精度が突然落ちた時の検知）。閾値は
`.github/workflows/eval.yml` の `EVAL_SCORE_THRESHOLD` で調整可能。

### PR コメント

`scripts/eval/ci-comment.mjs` が `--output-json` の出力を PR コメント形式の Markdown に変換し、
`gh pr comment` で投稿します。サマリ + Fixture 別スコア + 推定コスト + Actions ログ URL を含む
構造で、ノイズを抑えるため失敗フィールド diff はコメントには載せず Actions ログ側で確認します。

### Secrets 設定

リポジトリ設定 → Secrets and variables → Actions で以下を登録:

- `ANTHROPIC_API_KEY` — Anthropic コンソール発行の API キー。**Settings → Secrets → New repository secret**
  から登録すれば PR ラベル付与時に自動で使われます。

### ローカル動作確認

```bash
node scripts/eval/run.mjs --mock --output-json /tmp/eval-result.json
EVAL_MODE=mock node scripts/eval/ci-comment.mjs /tmp/eval-result.json
```
