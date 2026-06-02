/**
 * URL から物件情報を構造化抽出するためのシステム / ユーザープロンプト。
 *
 * pure function に切り出してスナップショットテストできるようにする。
 */

export const PROPERTY_EXTRACT_SYSTEM_PROMPT = `あなたは日本の店舗物件情報を扱う構造化抽出エージェントです。
HTML 本文から店舗物件の情報を抽出し、必ず \`extract_property\` ツール経由で
構造化された入力として返してください。

厳守事項:
1. 抽出できないフィールドは省略する（null や "" で埋めない）
2. 賃料・共益費は数値（円、整数）にする
3. 面積は数値（㎡）。坪は出力しない（クライアント側で換算）
4. 都道府県は 47 都道府県のいずれかに正規化する
5. slug は半角英数字とハイフンのみで構成し、最大 96 文字
6. publishedAt は ISO 8601（タイムゾーン Z）に揃える
7. 応答は必ず \`extract_property\` ツール呼び出しで返し、自由記述テキストを返さない
8. listedByRef が分からない場合は省略してよい（サーバー側でデモ用既定値を補完する）`;

export type ExtractPropertyUserPromptArgs = {
  readonly sourceUrl: string;
  readonly extractedHtmlText: string;
  readonly maxBodyLength?: number;
};

const DEFAULT_MAX_BODY = 12000;

export const buildExtractPropertyUserPrompt = ({
  sourceUrl,
  extractedHtmlText,
  maxBodyLength = DEFAULT_MAX_BODY,
}: ExtractPropertyUserPromptArgs): string => {
  const truncated =
    extractedHtmlText.length > maxBodyLength
      ? `${extractedHtmlText.slice(0, maxBodyLength)}\n…(truncated)`
      : extractedHtmlText;
  return `以下は ${sourceUrl} から取得し Mozilla Readability で本文抽出した HTML テキストです。
これを物件情報として JSON で抽出してください。

<source_url>${sourceUrl}</source_url>

<body>
${truncated}
</body>

期待する出力フィールド:
- title, slug
- address: { prefecture, city, streetAddress?, buildingName?, roomNumber?, geopoint: { lat, lng } }
- nearestStations[]: { line, station, walkMinutes }
- rent (整数), commonFee?, depositMonths?, keyMoneyMonths?, area (㎡), floor?
- buildingType (street_level | building_inline | second_floor_or_above | basement | stand_alone | other)
- condition (skeleton | second_hand | transferable_fixtures)
- previousBusiness?, suitableBusinessRefs[]
- description?, features[]
- availability (public | negotiating | closed)
- publishedAt (ISO 8601)
- aiConfidence: 0〜1 の自己推定信頼度

geopoint は本文から座標が得られない場合は住所から推定し、推定の場合は aiConfidence を下げてください。`;
};
