import { EMPTY_SEARCH_CRITERIA } from "@oceans-tenant/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseClaudeCriteriaResponse, sanitizeErrorForClient } from "../route";

describe("parseClaudeCriteriaResponse", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("有効な extractedCriteria を Zod 検証通過させ採用する", () => {
    const result = parseClaudeCriteriaResponse(
      JSON.stringify({
        message: "新宿で絞り込みます",
        extractedCriteria: {
          prefecture: "東京都",
          city: "新宿区",
          buildingTypes: ["street_level"],
          conditions: [],
          businessCategoryRefs: [],
        },
      }),
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.message).toBe("新宿で絞り込みます");
    expect(result.criteria.prefecture).toBe("東京都");
    expect(result.criteria.city).toBe("新宿区");
  });

  it("不正な都道府県は fallback を維持し定型文を返す", () => {
    const result = parseClaudeCriteriaResponse(
      JSON.stringify({
        message: "更新します",
        extractedCriteria: { prefecture: "江戸府" },
      }),
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
    expect(result.message).toBe("更新します");
  });

  it("未知の buildingType は fallback を維持", () => {
    const result = parseClaudeCriteriaResponse(
      JSON.stringify({ extractedCriteria: { buildingTypes: ["rooftop"] } }),
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
  });

  it("minRent > maxRent でも fallback を維持", () => {
    const result = parseClaudeCriteriaResponse(
      JSON.stringify({
        extractedCriteria: { minRent: 500000, maxRent: 100000 },
      }),
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
  });

  it("```json コードフェンスでくくられた応答も解析できる", () => {
    const result = parseClaudeCriteriaResponse(
      "```json\n" +
        JSON.stringify({
          message: "OK",
          extractedCriteria: { prefecture: "大阪府" },
        }) +
        "\n```",
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria.prefecture).toBe("大阪府");
  });

  it("JSON パース失敗時は応答テキストの先頭を message に丸める", () => {
    const result = parseClaudeCriteriaResponse("壊れた JSON ですすみません", EMPTY_SEARCH_CRITERIA);
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
    expect(result.message).toContain("壊れた JSON");
  });

  it("extractedCriteria 未指定なら fallback と message のみ返す", () => {
    const result = parseClaudeCriteriaResponse(
      JSON.stringify({ message: "もう少し詳しく教えてください" }),
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
    expect(result.message).toBe("もう少し詳しく教えてください");
  });

  it("extractedCriteria=null でも fallback を返す", () => {
    const result = parseClaudeCriteriaResponse(
      JSON.stringify({ message: "ok", extractedCriteria: null }),
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
  });
});

describe("sanitizeErrorForClient", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("一般的なエラーは定型文に丸める", () => {
    const result = sanitizeErrorForClient(new Error("内部 SDK エラー: API key invalid"));
    expect(result).toBe("処理中にエラーが発生しました。時間をおいて再度お試しください。");
  });

  it("ANTHROPIC_API_KEY 未設定のメッセージは透過する（運用者向け）", () => {
    const result = sanitizeErrorForClient(
      new Error("ANTHROPIC_API_KEY が未設定です。.env.local を確認してください。"),
    );
    expect(result).toContain("ANTHROPIC_API_KEY");
  });

  it("非 Error 値も String() で吸収", () => {
    const result = sanitizeErrorForClient({ weird: "object" });
    expect(result).toBe("処理中にエラーが発生しました。時間をおいて再度お試しください。");
  });

  it("一般エラーは console.error に出力される", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sanitizeErrorForClient(new Error("詳細メッセージ"));
    expect(spy).toHaveBeenCalled();
  });
});
