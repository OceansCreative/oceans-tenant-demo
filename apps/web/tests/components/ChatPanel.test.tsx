import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Next.js のフックをモック化（jsdom 環境用）
const mockReplace = vi.fn();
const mockSearchParams = {
  toString: () => "",
  get: () => null,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/uuid", () => ({
  generateUuidV4: () => "12345678-1234-4567-89ab-123456789abc",
}));

// scrollTo を spy しやすくするためのモック
const scrollToSpy = vi.fn();

beforeEach(() => {
  scrollToSpy.mockClear();
  Element.prototype.scrollTo = scrollToSpy as unknown as typeof Element.prototype.scrollTo;
});

import { ChatPanel } from "@/components/chat/ChatPanel";

describe("ChatPanel auto-scroll (Issue #56)", () => {
  it("初回マウント時に末尾までスクロールする", async () => {
    await act(async () => {
      render(<ChatPanel />);
    });
    expect(scrollToSpy).toHaveBeenCalled();
  });

  it("scrollTo が smooth behavior で呼ばれる", async () => {
    await act(async () => {
      render(<ChatPanel />);
    });
    const lastCall = scrollToSpy.mock.calls[scrollToSpy.mock.calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({ behavior: "smooth" });
  });
});
