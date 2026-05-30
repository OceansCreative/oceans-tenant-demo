import type { SearchCriteria } from "@/lib/search-criteria";

/**
 * 対話型検索のシステムプロンプト。
 * Claude には「ユーザーの発話から検索条件を抽出して JSON を返す」役割を持たせ、
 * 結果整形は決定論的なコードで行う。
 */
export const CHAT_SEARCH_SYSTEM_PROMPT = `あなたは日本の店舗物件マッチングを補助する対話エージェントです。
ユーザーは自然言語で物件の希望条件を述べます。
あなたの役割:

1. 直近のメッセージから検索条件 (prefecture / city / rent 範囲 / area 範囲 / buildingTypes /
   conditions / businessCategoryRefs / freeText) を抽出する
2. 条件がまだ揃わない場合は不足を 1 〜 2 つ質問で確認する
3. 抽出した条件は extractedCriteria に常に full set で返す（差分ではない）
4. 質問文は丁寧で簡潔（最長 2 文）

JSON 以外の出力をしないこと。
`;

export type ChatMessageInput = {
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
};

export type BuildChatSearchPromptArgs = {
  readonly messages: ReadonlyArray<ChatMessageInput>;
  readonly currentCriteria?: SearchCriteria;
};

export const buildChatSearchUserContext = ({
  currentCriteria,
}: Pick<BuildChatSearchPromptArgs, "currentCriteria">): string => {
  const json = currentCriteria ? JSON.stringify(currentCriteria, null, 2) : "{}";
  return `現在抽出されている検索条件:
\`\`\`json
${json}
\`\`\`
これを最新メッセージの内容で更新してください。`;
};

/**
 * Anthropic SDK の messages[] 形式に変換する。
 * system プロンプトは別フィールドとして渡すため、ここからは除外する。
 */
export const toAnthropicMessages = (
  messages: ReadonlyArray<ChatMessageInput>,
): ReadonlyArray<{ role: "user" | "assistant"; content: string }> =>
  messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
