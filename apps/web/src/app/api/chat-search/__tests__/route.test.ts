import { EMPTY_SEARCH_CRITERIA } from "@oceans-tenant/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAbortError, parseClaudeCriteriaToolInput, sanitizeErrorForClient } from "../route";

describe("parseClaudeCriteriaToolInput", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("有効な criteria を Zod 検証通過させ採用する", () => {
    const result = parseClaudeCriteriaToolInput(
      {
        message: "新宿で絞り込みます",
        criteria: {
          prefecture: "東京都",
          city: "新宿区",
          buildingTypes: ["street_level"],
          conditions: [],
          businessCategoryRefs: [],
        },
      },
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.message).toBe("新宿で絞り込みます");
    expect(result.criteria.prefecture).toBe("東京都");
    expect(result.criteria.city).toBe("新宿区");
  });

  it("不正な都道府県は fallback を維持し定型文を返す", () => {
    const result = parseClaudeCriteriaToolInput(
      { message: "更新します", criteria: { prefecture: "江戸府" } },
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
    expect(result.message).toBe("更新します");
  });

  it("未知の buildingType は fallback を維持", () => {
    const result = parseClaudeCriteriaToolInput(
      { criteria: { buildingTypes: ["rooftop"] } },
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
  });

  it("minRent > maxRent でも fallback を維持", () => {
    const result = parseClaudeCriteriaToolInput(
      { criteria: { minRent: 500000, maxRent: 100000 } },
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
  });

  it("criteria 未指定なら fallback と message のみ返す", () => {
    const result = parseClaudeCriteriaToolInput(
      { message: "もう少し詳しく教えてください" },
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
    expect(result.message).toBe("もう少し詳しく教えてください");
  });

  it("criteria=null でも fallback を返す", () => {
    const result = parseClaudeCriteriaToolInput(
      { message: "ok", criteria: null },
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
  });

  it("input が object でない場合は fallback と既定 message", () => {
    const result = parseClaudeCriteriaToolInput("壊れたリテラル", EMPTY_SEARCH_CRITERIA);
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
    expect(result.message).toBe("応答を解析できませんでした。");
  });

  it("input が null の場合も fallback を返す", () => {
    const result = parseClaudeCriteriaToolInput(null, EMPTY_SEARCH_CRITERIA);
    expect(result.criteria).toEqual(EMPTY_SEARCH_CRITERIA);
  });

  it("message が空文字なら既定文に置き換える", () => {
    const result = parseClaudeCriteriaToolInput(
      { message: "", criteria: { prefecture: "東京都" } },
      EMPTY_SEARCH_CRITERIA,
    );
    expect(result.message).toBe("条件を更新しました。");
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

describe("isAbortError", () => {
  it("AbortError 名のエラーを真として判定", () => {
    const err = new Error("Request aborted");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("Anthropic SDK の APIUserAbortError 風オブジェクトも検知", () => {
    const err = new Error("user aborted");
    err.name = "APIUserAbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("メッセージに abort を含めば検知", () => {
    expect(isAbortError(new Error("connection was aborted"))).toBe(true);
  });

  it("無関係なエラーは false", () => {
    expect(isAbortError(new Error("timeout"))).toBe(false);
  });

  it("非オブジェクトは false", () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError("aborted")).toBe(false);
  });
});
