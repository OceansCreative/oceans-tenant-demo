/**
 * Web Vitals サンプルの in-memory store。
 *
 * **重要な前提**: 本実装は **同一 Node プロセスのメモリ内** にバケットを持つ。
 * Vercel / 一般的な serverless 環境では各インスタンスが独立しているため、
 * 全 region / 全インスタンス横断で正しい統計を出すことは**保証されない**。
 * 本実装は OSS リファレンス実装として「フィールド計測の最小サンプル」を示す
 * ことが目的であり、本番運用時は ClickHouse / BigQuery / Sentry / Datadog などの
 * 集中ストアへ送信先を差し替える前提。`rate-limit.ts` と同じ注意。
 *
 * 設計上の制約:
 * - 同一プロセスで最大 1000 件 / `${metric}:${path}` キーで保持
 *   → 超過時は古いものから FIFO で evict
 * - キー総数の上限は別途設けない（5 メトリクス × 数十 path 程度を想定）
 * - サンプル個別の timestamp は将来の時間窓集計のため残すが、現状は集計に使わない
 *
 * テスト容易性のため、`__resetVitalsStoreForTesting` でグローバル状態をリセットできる。
 */

import type { MetricSummary } from "./aggregate";
import { buildBucketKey, type Sample, summarizeAllSamples } from "./aggregate";
import type { VitalsMetric } from "./types";

/**
 * 1 (metric, path) あたりの保持上限。超えたら古いものから捨てる。
 * 1000 件は OSS デモとして十分なサイズで、メモリ使用量も数十 KB 程度に収まる。
 */
const MAX_SAMPLES_PER_KEY = 1000;

/**
 * `${metric}:${path}` → サンプル配列の Map。
 * Map のキー反復順は挿入順なので、別途 LRU 管理は不要。
 */
const buckets = new Map<string, Sample[]>();

/**
 * テスト用にバケットを全消去する。**プロダクションコードから呼ばないこと**。
 */
export const __resetVitalsStoreForTesting = (): void => {
  buckets.clear();
};

/**
 * テスト用に現在のバケット状態を覗き見る。**プロダクションコードから呼ばないこと**。
 */
export const __getVitalsBucketsForTesting = (): ReadonlyMap<string, ReadonlyArray<Sample>> =>
  buckets;

/**
 * サンプルを 1 件追加する。
 *
 * - 既存バケットが上限に達していたら、先頭（最古）を `shift()` で捨てる
 * - 値はそのまま保存（負値や NaN などのバリデーションは route 側の Zod で済ませる前提）
 * - 並行アクセスは Node.js のシングルスレッド前提で考慮不要
 */
export const recordVitalsSample = (
  metric: VitalsMetric,
  path: string,
  value: number,
  timestamp: number = Date.now(),
): void => {
  const key = buildBucketKey(metric, path);
  const existing = buckets.get(key);
  if (existing) {
    existing.push({ value, timestamp });
    if (existing.length > MAX_SAMPLES_PER_KEY) {
      // 古いものから 1 件削除（push 前にチェックしても良いが、push 後の方が境界条件が単純）
      existing.shift();
    }
    return;
  }
  buckets.set(key, [{ value, timestamp }]);
};

/**
 * 全バケットをまとめて `MetricSummary[]` に集計する。
 *
 * 並び順は `summarizeAllSamples` の規約（metric 宣言順 → path 昇順）に従う。
 */
export const getAllVitalsSummary = (): ReadonlyArray<MetricSummary> => summarizeAllSamples(buckets);

/**
 * `MAX_SAMPLES_PER_KEY` を外部に公開するための getter。
 * テストや UI（情報表示）で使う想定。直接 export 定数にしないのは将来的に
 * 環境変数オーバーライドできるようにするため。
 */
export const getMaxSamplesPerKey = (): number => MAX_SAMPLES_PER_KEY;
