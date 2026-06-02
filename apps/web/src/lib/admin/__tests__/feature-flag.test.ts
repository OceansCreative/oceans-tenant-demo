import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAdminEnabled, parseAdminEnabledFlag } from "../feature-flag";

/**
 * Admin feature flag のテスト。
 *
 * - `"true"` 文字列完全一致のみが有効
 * - それ以外（"1" / "TRUE" / undefined / 空 / ホワイトスペース付き）は無効
 *
 * 仕様: 緩い解釈による本番事故を避けるため、許可する値を厳密に絞っている。
 */

describe("parseAdminEnabledFlag", () => {
  it("'true' は有効", () => {
    expect(parseAdminEnabledFlag("true")).toBe(true);
  });

  it("undefined は無効（env 未設定）", () => {
    expect(parseAdminEnabledFlag(undefined)).toBe(false);
  });

  it("空文字列は無効", () => {
    expect(parseAdminEnabledFlag("")).toBe(false);
  });

  it("'TRUE' (大文字) は無効", () => {
    expect(parseAdminEnabledFlag("TRUE")).toBe(false);
  });

  it("'1' は無効", () => {
    expect(parseAdminEnabledFlag("1")).toBe(false);
  });

  it("'yes' は無効", () => {
    expect(parseAdminEnabledFlag("yes")).toBe(false);
  });

  it("ホワイトスペース付きの ' true ' は無効", () => {
    expect(parseAdminEnabledFlag(" true ")).toBe(false);
  });

  it("'false' は無効", () => {
    expect(parseAdminEnabledFlag("false")).toBe(false);
  });
});

describe("isAdminEnabled", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_ENABLED", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("env が 'true' なら true を返す", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_ENABLED", "true");
    expect(isAdminEnabled()).toBe(true);
  });

  it("env が空文字列なら false を返す", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_ENABLED", "");
    expect(isAdminEnabled()).toBe(false);
  });
});
