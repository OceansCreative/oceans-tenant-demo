/**
 * @file fixture HTML から Claude を呼んで Property 風オブジェクトを得る共通ロジック。
 *
 * 実 API 経路と モック経路の差を吸収し、`run.mjs` から `extractFromHtml()` 1 関数を呼ぶだけで
 * 評価できるようにする。
 *
 * 設計上の注意:
 * - `apps/web` 側の TypeScript ソース（プロンプト / Tool 定義）を `.mjs` から直接 import するのは
 *   ビルド整備が重いため、評価ハーネス内に **プロンプトと Tool 名の文字列定数だけ複製** する。
 *   将来 apps/web の TS を再利用したくなった場合は esbuild / tsx でランナーを切り替える方針。
 * - HTML 本文抽出は本番フローの一部だが、評価では fixture HTML をそのまま素朴に
 *   `<body>` まるごと渡す（Readability の依存を eval harness に持ち込まない）。
 */

const SYSTEM_PROMPT = `あなたは日本の店舗物件情報を扱う構造化抽出エージェントです。
HTML 本文から店舗物件の情報を抽出し、必ず \`extract_property\` ツール経由で
構造化された入力として返してください。

厳守事項:
1. 抽出できないフィールドは省略する（null や "" で埋めない）
2. 賃料・共益費は数値（円、整数）にする
3. 面積は数値（㎡）。坪は出力しない（クライアント側で換算）
4. 都道府県は 47 都道府県のいずれかに正規化する
5. 応答は必ず \`extract_property\` ツール呼び出しで返し、自由記述テキストを返さない`;

/**
 * @param {{ sourceUrl: string; htmlText: string; maxBodyLength?: number }} args
 */
const buildUserPrompt = ({ sourceUrl, htmlText, maxBodyLength = 12000 }) => {
  const truncated =
    htmlText.length > maxBodyLength ? `${htmlText.slice(0, maxBodyLength)}\n…(truncated)` : htmlText;
  return `以下は ${sourceUrl} から取得した HTML テキストです。
これを物件情報として JSON で抽出してください。

<source_url>${sourceUrl}</source_url>

<body>
${truncated}
</body>`;
};

/**
 * tool_use ブロックの `input` を取り出す。
 *
 * @param {ReadonlyArray<{ type: string; name?: string; input?: unknown }>} blocks
 * @returns {Record<string, unknown> | null}
 */
const findToolUseInput = (blocks) => {
  for (const b of blocks) {
    if (b.type === "tool_use" && b.name === "extract_property") {
      return typeof b.input === "object" && b.input !== null
        ? /** @type {Record<string, unknown>} */ (b.input)
        : {};
    }
  }
  return null;
};

/**
 * @typedef {Object} ExtractClient
 * @property {{ create: (args: { messages: Array<{ role: string; content: string }> }) =>
 *   Promise<{ content: ReadonlyArray<{ type: string; name?: string; input?: unknown }> }> }} messages
 */

/**
 * @param {{ client: ExtractClient; sourceUrl: string; htmlText: string }} args
 * @returns {Promise<Record<string, unknown> | null>}
 */
export const extractFromHtml = async ({ client, sourceUrl, htmlText }) => {
  const userPrompt = buildUserPrompt({ sourceUrl, htmlText });
  const completion = await client.messages.create({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  return findToolUseInput(completion.content);
};

/**
 * 実 Anthropic SDK ベースのクライアントを生成。
 * - `ANTHROPIC_API_KEY` が無ければ null を返し、呼び出し側でモックに切り替える契機にする
 *
 * @returns {Promise<ExtractClient | null>}
 */
export const createRealAnthropicClient = async () => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // 動的 import: モック実行時は @anthropic-ai/sdk を解決しない
  const mod = await import("@anthropic-ai/sdk").catch(() => null);
  if (!mod) {
    console.warn("[eval] @anthropic-ai/sdk が解決できません。pnpm install 後に再実行してください。");
    return null;
  }
  const Anthropic = mod.default;
  const sdk = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  return {
    messages: {
      create: async ({ messages }) => {
        const systemMsg = messages.find((m) => m.role === "system");
        const userMsg = messages.find((m) => m.role === "user");
        const result = await sdk.messages.create({
          model,
          max_tokens: 2048,
          system: systemMsg?.content ?? "",
          tools: [
            {
              name: "extract_property",
              description: "HTML 本文から抽出した店舗物件情報を構造化された JSON で登録するためのツール。",
              input_schema: {
                type: "object",
                additionalProperties: true,
              },
            },
          ],
          tool_choice: { type: "tool", name: "extract_property" },
          messages: [{ role: "user", content: userMsg?.content ?? "" }],
        });
        return { content: result.content };
      },
    },
  };
};
