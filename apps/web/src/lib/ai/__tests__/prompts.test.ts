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
  it("空 criteria で _type フィルタのみ", () => {
    const result = buildPropertyGroq({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
    });
    expect(result.groq).toContain('_type == "property"');
    expect(result.params).toEqual({});
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
      }),
    ).toThrow(GroqInjectionError);
  });

  it("city にクォートが含まれていても除去して埋め込む", () => {
    const result = buildPropertyGroq({
      buildingTypes: [],
      conditions: [],
      businessCategoryRefs: [],
      city: 'new"york',
    });
    expect(result.params.city).toBe("newyork");
  });

  it("limit が範囲外だと GroqInjectionError", () => {
    expect(() =>
      buildPropertyGroq({ buildingTypes: [], conditions: [], businessCategoryRefs: [] }, 300),
    ).toThrow(GroqInjectionError);
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
