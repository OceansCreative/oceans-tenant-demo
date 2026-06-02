import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { renderWithI18n } from "../test-utils";

/**
 * LocaleSwitcher の振る舞いをテストする。
 *
 * - 現在 locale が select の value に反映される
 * - 他 locale を選ぶと `NEXT_LOCALE` cookie が更新され `window.location.reload()` が呼ばれる
 * - 同じ locale を選んでも reload しない（不要な再描画防止）
 */

const reloadMock = vi.fn();

beforeEach(() => {
  reloadMock.mockReset();
  // jsdom の Location は read-only な reload を持つので Object.defineProperty で差し替える。
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, reload: reloadMock },
  });
  // jsdom 上で cookie をリセット。`document.cookie = ""` は空文字代入で全消去はできないが、
  // テストでは前ケースの NEXT_LOCALE が残っていないかだけ気にすれば十分。
  // biome-ignore lint/suspicious/noDocumentCookie: テスト用に cookie をリセットする
  document.cookie = `${"NEXT_LOCALE"}=; Path=/; Max-Age=0`;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LocaleSwitcher", () => {
  it("ja を初期 locale として select に表示する", () => {
    renderWithI18n(<LocaleSwitcher />);
    const select = screen.getByRole("combobox", { name: "言語" }) as HTMLSelectElement;
    expect(select.value).toBe("ja");
  });

  it("en を初期 locale として select に表示する", () => {
    renderWithI18n(<LocaleSwitcher />, { locale: "en" });
    const select = screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement;
    expect(select.value).toBe("en");
  });

  it("対応 locale すべてが option として並ぶ", () => {
    renderWithI18n(<LocaleSwitcher />);
    expect(screen.getByRole("option", { name: "日本語" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
  });

  it("別 locale を選ぶと cookie に書き込み reload を呼ぶ", () => {
    renderWithI18n(<LocaleSwitcher />);
    const select = screen.getByRole("combobox", { name: "言語" });
    fireEvent.change(select, { target: { value: "en" } });
    expect(document.cookie).toContain("NEXT_LOCALE=en");
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("同じ locale を選んだ場合は reload しない", () => {
    renderWithI18n(<LocaleSwitcher />);
    const select = screen.getByRole("combobox", { name: "言語" });
    fireEvent.change(select, { target: { value: "ja" } });
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("対応外の値が選ばれても reload しない（型ガード）", () => {
    renderWithI18n(<LocaleSwitcher />);
    const select = screen.getByRole("combobox", { name: "言語" });
    fireEvent.change(select, { target: { value: "fr" } });
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
