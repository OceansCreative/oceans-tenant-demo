import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("文字列を空白で連結する", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("undefined / null / false を除外する", () => {
    expect(cn("a", undefined, null, false, "b")).toBe("a b");
  });

  it("引数なしで空文字を返す", () => {
    expect(cn()).toBe("");
  });

  it("全て falsy だと空文字を返す", () => {
    expect(cn(undefined, null, false)).toBe("");
  });
});
