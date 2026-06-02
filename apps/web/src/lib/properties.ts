import {
  derivePropertyTsubo,
  type Property,
  type PropertyWithTsubo,
  propertySchema,
} from "@oceans-tenant/shared";
import { buildPropertyCountGroq, buildPropertyGroq } from "@/lib/ai/prompts/query-build";
import { type FilteredProperties, filterProperties } from "@/lib/filter-properties";
import { getSanityClient } from "@/lib/sanity/client";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import type { SearchCriteria } from "@/lib/search-criteria";

/**
 * 物件取得の中心ロジック。
 *
 * - `getSanityClient()` が `null`（= env 未設定）なら従来の mock 経路（`filterProperties`）
 * - `null` 以外なら GROQ で実 Sanity に問い合わせ、`propertySchema.array()` で検証
 * - 検証失敗 / fetch 失敗時は **mock fallback + console.error** で本番事故時の死活を守る
 *
 * 戻り値型は v0.3.0 から不変の `{ items, totalCount }`。
 * page-based pagination は GROQ の `[$offset...$offset + $limit]` で実現し、
 * 件数は `count(*[<filter>])` の別クエリで取得する。
 */

const isUnknownArray = (value: unknown): value is ReadonlyArray<unknown> => Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const fallbackToMock = (criteria: SearchCriteria): FilteredProperties =>
  filterProperties(MOCK_PROPERTIES, criteria);

/**
 * GROQ レスポンスを `Property` 配列に検証する。検証失敗時は `null` を返す。
 *
 * `any` 禁止のため `unknown` で受け、`propertySchema.array().safeParse` を通したものだけ
 * 信頼する。projection が GROQ 側でずれていても、ここで弾けば後段に壊れた値が流れない。
 */
const parsePropertyArray = (raw: unknown): ReadonlyArray<Property> | null => {
  if (!isUnknownArray(raw)) return null;
  const parsed = propertySchema.array().safeParse(raw);
  if (!parsed.success) {
    console.error("[properties] Sanity レスポンスの Zod 検証に失敗", parsed.error.flatten());
    return null;
  }
  return parsed.data;
};

/**
 * v0.3.0 から不変の戻り値型エイリアス。
 * `filterProperties` の戻り値と完全に同じ形を維持することで、既存呼び出し側を変えずに済む。
 */
export type FetchPropertiesResult = FilteredProperties;

/**
 * 環境変数 (Sanity env 三点セット) の有無に応じて mock / 実接続を切り替えて物件を取得する。
 *
 * v0.4.0 WS-2: 切替コードを集約し、ページ / API Route は本関数だけを呼べばよい状態にする。
 * page / pageSize / その他条件は `buildPropertyGroq` 経由で `[$offset...$offset + $limit]`
 * 形の GROQ に変換され、件数は `buildPropertyCountGroq` 経由で別クエリで取得する。
 */
export const fetchProperties = async (criteria: SearchCriteria): Promise<FetchPropertiesResult> => {
  const client = getSanityClient();
  if (!client) {
    return fallbackToMock(criteria);
  }

  try {
    const { groq, params } = buildPropertyGroq(criteria);
    const { groq: countGroq, params: countParams } = buildPropertyCountGroq(criteria);

    const [rawItems, rawCount] = await Promise.all([
      client.fetch<unknown>(groq, params),
      client.fetch<unknown>(countGroq, countParams),
    ]);

    const parsedItems = parsePropertyArray(rawItems);
    if (parsedItems === null) {
      return fallbackToMock(criteria);
    }
    if (!isNumber(rawCount) || !Number.isInteger(rawCount) || rawCount < 0) {
      console.error("[properties] count GROQ が整数を返さなかった", { rawCount });
      return fallbackToMock(criteria);
    }

    const items: ReadonlyArray<PropertyWithTsubo> = parsedItems.map(derivePropertyTsubo);
    return { items, totalCount: rawCount };
  } catch (error: unknown) {
    console.error("[properties] Sanity からの物件取得で例外", error);
    return fallbackToMock(criteria);
  }
};
