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

## CI 統合について

このハーネスは **本 PR では CI に組み込んでいません**。理由は次の通り。

- 実 Claude 呼び出しが必要なため、CI 実行ごとに API コストが発生する
- 主要ワークフローで毎回回すには重く、品質ゲートにする閾値設計も別途必要

将来的には `.github/workflows/eval.yml` で **PR ラベル `eval` 付与時** または
**weekly cron** で実行する方針を想定しています。
