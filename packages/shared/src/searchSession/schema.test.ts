import { describe, expect, it } from "vitest";
import {
  chatMessageSchema,
  extractedSearchCriteriaSchema,
  searchSessionSchema,
  sessionIdSchema,
} from "./schema.js";

const VALID_UUID = "12345678-1234-4567-89ab-123456789abc";

describe("sessionIdSchema", () => {
  it("有効な UUID v4 を受け入れる", () => {
    expect(sessionIdSchema.parse(VALID_UUID)).toBe(VALID_UUID);
  });

  it("UUID v1（version 1）は拒否", () => {
    // バージョン番号が 1
    expect(() => sessionIdSchema.parse("12345678-1234-1567-89ab-123456789abc")).toThrow();
  });

  it("空文字は拒否", () => {
    expect(() => sessionIdSchema.parse("")).toThrow();
  });
});

describe("chatMessageSchema", () => {
  it("user / assistant / system の role を受け入れる", () => {
    for (const role of ["user", "assistant", "system"] as const) {
      expect(
        chatMessageSchema.parse({
          role,
          content: "メッセージ",
          createdAt: "2026-05-01T00:00:00.000Z",
        }).role,
      ).toBe(role);
    }
  });

  it("content が空だと拒否", () => {
    expect(() =>
      chatMessageSchema.parse({
        role: "user",
        content: "",
        createdAt: "2026-05-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("createdAt が ISO 8601 でないと拒否", () => {
    expect(() =>
      chatMessageSchema.parse({
        role: "user",
        content: "テスト",
        createdAt: "2026-05-01",
      }),
    ).toThrow();
  });
});

describe("extractedSearchCriteriaSchema", () => {
  it("空オブジェクトを受け入れる", () => {
    expect(extractedSearchCriteriaSchema.parse({})).toEqual({});
  });

  it("複数フィールドを受け入れる", () => {
    expect(
      extractedSearchCriteriaSchema.parse({
        prefectures: ["東京都"],
        minRent: 100000,
        maxRent: 500000,
        minArea: 20,
        maxArea: 100,
      }).minRent,
    ).toBe(100000);
  });

  it("minRent > maxRent は拒否", () => {
    expect(() =>
      extractedSearchCriteriaSchema.parse({
        minRent: 600000,
        maxRent: 300000,
      }),
    ).toThrow();
  });

  it("minArea > maxArea は拒否", () => {
    expect(() =>
      extractedSearchCriteriaSchema.parse({
        minArea: 100,
        maxArea: 50,
      }),
    ).toThrow();
  });
});

describe("searchSessionSchema", () => {
  const baseSession = {
    sessionId: VALID_UUID,
    messages: [
      {
        role: "user" as const,
        content: "新宿で 30 坪くらいのカフェ物件を探したい",
        createdAt: "2026-05-01T10:00:00.000Z",
      },
    ],
    resultPropertyRefs: ["property-001"],
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:05:00.000Z",
  };

  it("基本的なセッションを受け入れる", () => {
    expect(searchSessionSchema.parse(baseSession).messages).toHaveLength(1);
  });

  it("messages 未指定でもデフォルト [] が適用される", () => {
    const noMessages = { ...baseSession, messages: undefined };
    expect(searchSessionSchema.parse(noMessages).messages).toEqual([]);
  });

  it("updatedAt < createdAt は拒否", () => {
    expect(() =>
      searchSessionSchema.parse({
        ...baseSession,
        updatedAt: "2026-04-30T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("messages が 101 件だと拒否", () => {
    const tooMany = Array.from({ length: 101 }, () => ({
      role: "user" as const,
      content: "ping",
      createdAt: "2026-05-01T10:00:00.000Z",
    }));
    expect(() => searchSessionSchema.parse({ ...baseSession, messages: tooMany })).toThrow();
  });

  it("不正な sessionId は拒否", () => {
    expect(() => searchSessionSchema.parse({ ...baseSession, sessionId: "not-uuid" })).toThrow();
  });

  it("未知フィールドは strict で拒否", () => {
    expect(() => searchSessionSchema.parse({ ...baseSession, unknownField: "x" })).toThrow();
  });
});
