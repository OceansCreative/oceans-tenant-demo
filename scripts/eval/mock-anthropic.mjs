/**
 * @file 実 Claude を呼ばずにハーネス自体の動作を検証するためのモック。
 *
 * 仕様:
 * - `ANTHROPIC_API_KEY` 未設定または `--mock` フラグ指定時に使用
 * - fixture id を入力プロンプトから推測し、対応する expected.json を **少しノイズを混ぜて**
 *   `extract_property` の `tool_use` ブロックとして返す
 * - これによりメトリクスは「ほぼ正解だが完璧ではない」状態の出力を得られ、
 *   レポート生成の動作確認になる
 *
 * このモックは評価ではなく **harness のスモークテスト** が目的。実精度を測りたい場合は
 * `ANTHROPIC_API_KEY` を設定して `--mock` を外す。
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

/**
 * fixture id を userPrompt 内の <source_url> から取り出す。
 * 例: <source_url>file://.../cafe-shibuya.html</source_url> → "cafe-shibuya"
 *
 * @param {string} userPrompt
 * @returns {string | null}
 */
const extractFixtureId = (userPrompt) => {
  const match = userPrompt.match(/<source_url>([^<]+)<\/source_url>/);
  if (!match) return null;
  const url = match[1];
  const base = url.split("/").pop() ?? "";
  return base.replace(/\.html$/, "");
};

/**
 * expected.json をベースに、軽くノイズを入れた擬似 Claude 出力を作る。
 * - `aiConfidence` を 0.78 として注入
 * - 50% の確率で `features` の最後の 1 件をドロップ（モック動作の確認）
 *
 * @param {Record<string, unknown>} expected
 * @returns {Record<string, unknown>}
 */
const buildMockOutput = (expected) => {
  /** @type {Record<string, unknown>} */
  const out = { ...expected };
  // 軽微ノイズ: features を 1 要素短くしてメトリクスに差が出るようにする
  if (Array.isArray(out.features) && out.features.length > 1) {
    out.features = out.features.slice(0, -1);
  }
  out.aiConfidence = 0.78;
  return out;
};

/**
 * Anthropic SDK の `messages.create` 互換シグネチャを持つモック実装。
 * `client.messages.create(...)` 形で渡せる最小形を返す。
 */
export const createMockAnthropicClient = () => ({
  messages: {
    /**
     * @param {{ messages: Array<{ role: string; content: string }> }} params
     */
    create: async (params) => {
      const user = params.messages.find((m) => m.role === "user");
      const fixtureId = user ? extractFixtureId(user.content) : null;
      if (!fixtureId) {
        return {
          content: [
            {
              type: "tool_use",
              name: "extract_property",
              input: {},
            },
          ],
        };
      }
      const raw = await readFile(join(FIXTURES_DIR, `${fixtureId}.expected.json`), "utf8");
      const expected = JSON.parse(raw);
      return {
        content: [
          {
            type: "tool_use",
            name: "extract_property",
            input: buildMockOutput(expected),
          },
        ],
      };
    },
  },
});
