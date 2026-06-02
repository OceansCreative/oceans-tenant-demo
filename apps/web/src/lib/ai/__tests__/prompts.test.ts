import { describe, expect, it } from "vitest";
import {
  buildChatSearchUserContext,
  CHAT_SEARCH_SYSTEM_PROMPT,
  toAnthropicMessages,
} from "@/lib/ai/prompts/chat-search";
import {
  buildExtractPropertyUserPrompt,
  PROPERTY_EXTRACT_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/extract-property";
import { buildPropertyGroq, GroqInjectionError } from "@/lib/ai/prompts/query-build";

describe("PROPERTY_EXTRACT_SYSTEM_PROMPT", () => {
  it("厳守事項を含むスナップショット", () => {
    expect(PROPERTY_EXTRACT_SYSTEM_PROMPT).toMatchSnapshot();
  });
});

describe("buildExtractPropertyUserPrompt", () => {
  it("既定の最大本文長で切り詰める", () => {
    const longBody = "あ".repeat(15000);
    const prompt = buildExtractPropertyUserPrompt({
      sourceUrl: "https://example.com/listings/1",
      extractedHtmlText: longBody,
    });
    expect(prompt).toContain("…(truncated)");
    expect(prompt).toContain("https://example.com/listings/1");
  });

  it("短い本文はそのまま埋め込む", () => {
    const prompt = buildExtractPropertyUserPrompt({
      sourceUrl: "https://example.com/x",
      extractedHtmlText: "テスト物件本文",
    });
    expect(prompt).toContain("テスト物件本文");
    expect(prompt).not.toContain("…(truncated)");
  });
});

describe("buildPropertyGroq", () => {
  it("空 criteria で _type フィルタのみ + デフォルトの limit/offset", () => {
    const result = buildPropertyGroq({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
      page: 1,
      pageSize: 20,
    });
    expect(result.groq).toContain('_type == "property"');
    // criteria.page / pageSize から導出した limit / offset が必ず入る
    expect(result.params).toEqual({ limit: 20, offset: 0 });
  });

  it("複数条件のときに params が揃う", () => {
    const result = buildPropertyGroq({
      prefecture: "東京都",
      city: "新宿区",
      minRent: 100000,
      maxRent: 500000,
      minArea: 20,
      maxArea: 100,
      buildingTypes: ["street_level"],
      conditions: ["skeleton"],
      businessCategoryRefs: ["category-cafe"],
      q: "新宿",
      page: 1,
      pageSize: 20,
    });
    expect(result.params.prefecture).toBe("東京都");
    expect(result.params.minRent).toBe(100000);
    expect(result.params.maxRent).toBe(500000);
    expect(result.params.buildingTypes).toEqual(["street_level"]);
    expect(result.params.businessRefs).toEqual(["category-cafe"]);
    expect(result.groq).toContain("rent >= $minRent");
    expect(result.groq).toContain("rent <= $maxRent");
    expect(result.groq).toContain("address.prefecture == $prefecture");
    expect(result.groq).toContain("buildingType in $buildingTypes");
  });

  it("不正な businessCategoryRef は GroqInjectionError", () => {
    expect(() =>
      buildPropertyGroq({
        buildingTypes: [],
        conditions: [],
        businessCategoryRefs: ["malicious; *[]"],
        page: 1,
        pageSize: 20,
      }),
    ).toThrow(GroqInjectionError);
  });

  it("city にクォートが含まれていても除去して埋め込む", () => {
    const result = buildPropertyGroq({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
      page: 1,
      pageSize: 20,
      city: 'new"york',
    });
    expect(result.params.city).toBe("newyork");
  });

  it("limit が範囲外だと GroqInjectionError", () => {
    expect(() =>
      buildPropertyGroq(
        { buildingTypes: [], conditions: [], businessCategoryRefs: [], page: 1, pageSize: 20 },
        300,
      ),
    ).toThrow(GroqInjectionError);
  });

  it("page / pageSize から limit / offset を導出し $offset...$offset + $limit を出力", () => {
    const result = buildPropertyGroq({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
      page: 3,
      pageSize: 25,
    });
    expect(result.params.limit).toBe(25);
    expect(result.params.offset).toBe(50); // (3 - 1) * 25
    expect(result.groq).toContain("[$offset...$offset + $limit]");
  });

  it("offset 引数で明示的に上書きできる", () => {
    const result = buildPropertyGroq(
      {
        buildingTypes: [],
        conditions: [],
        businessCategoryRefs: [],
        page: 1,
        pageSize: 20,
      },
      30,
      100,
    );
    expect(result.params.limit).toBe(30);
    expect(result.params.offset).toBe(100);
  });

  it("offset が負だと GroqInjectionError", () => {
    expect(() =>
      buildPropertyGroq(
        { buildingTypes: [], conditions: [], businessCategoryRefs: [], page: 1, pageSize: 20 },
        20,
        -1,
      ),
    ).toThrow(GroqInjectionError);
  });

  // Issue #86 / #87: GROQ projection が shared Zod 形に橋渡しすることを契約として固定
  it("projection は Sanity → shared Zod を橋渡しする（aiMeta ネスト / *Refs 文字列）", () => {
    const result = buildPropertyGroq({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
      page: 1,
      pageSize: 20,
    });
    // aiMeta はネスト形で取得
    expect(result.groq).toContain('"aiMeta"');
    expect(result.groq).toContain('"aiExtracted": aiExtracted');
    expect(result.groq).toContain('"aiConfidence": aiConfidence');
    expect(result.groq).toContain('"sourceUrl": sourceUrl');
    // reference は _ref 文字列に展開
    expect(result.groq).toContain('"suitableBusinessRefs": suitableBusinesses[]._ref');
    expect(result.groq).toContain('"listedByRef": listedBy._ref');
  });

  it("projection に tsubo は含めない（坪換算は shared squareMeterToTsubo を単一真実とする）", () => {
    // Issue #87: GROQ で `area * 0.3025` を出すと丸めが効かず JS と食い違うため撤去
    const result = buildPropertyGroq({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
      page: 1,
      pageSize: 20,
    });
    expect(result.groq).not.toContain("tsubo");
    expect(result.groq).not.toContain("0.3025");
  });
});

describe("buildChatSearchUserContext", () => {
  it("currentCriteria を JSON で埋め込む", () => {
    const text = buildChatSearchUserContext({
      currentCriteria: {
        prefecture: "東京都",
        buildingTypes: [],
        conditions: [],
        businessCategoryRefs: [],
        page: 1,
        pageSize: 20,
      },
    });
    expect(text).toContain("東京都");
    expect(text).toContain("```json");
  });

  it("currentCriteria 未指定なら空 object", () => {
    expect(buildChatSearchUserContext({})).toContain("{}");
  });
});

describe("CHAT_SEARCH_SYSTEM_PROMPT", () => {
  it("スナップショット", () => {
    expect(CHAT_SEARCH_SYSTEM_PROMPT).toMatchSnapshot();
  });
});

describe("toAnthropicMessages", () => {
  it("system は除外し user/assistant のみ返す", () => {
    const result = toAnthropicMessages([
      { role: "system", content: "system msg" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
    ]);
    expect(result).toEqual([
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
    ]);
  });

  it("空配列は空配列", () => {
    expect(toAnthropicMessages([])).toEqual([]);
  });
});
