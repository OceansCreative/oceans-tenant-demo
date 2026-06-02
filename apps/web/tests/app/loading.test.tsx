import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChatLoading from "@/app/chat/loading";
import RootLoading from "@/app/loading";
import PropertyDetailLoading from "@/app/properties/[slug]/loading";
import SearchLoading from "@/app/search/loading";

/**
 * 各 route の `loading.tsx` が「スクリーンリーダー向け文言を含み、aria-busy=true で
 * 即時返却される」ことを確認するスモークテスト。
 *
 * v0.6.0 WS-2 で導入。Lighthouse FCP / LCP を稼ぐための Streaming UI の最小契約を担保する。
 */
describe("route 別 loading.tsx", () => {
  const cases = [
    { name: "root", Component: RootLoading, expectText: "読み込み中" },
    { name: "search", Component: SearchLoading, expectText: "検索結果を読み込み中" },
    { name: "chat", Component: ChatLoading, expectText: "対話画面を準備中" },
    { name: "properties/[slug]", Component: PropertyDetailLoading, expectText: "物件詳細" },
  ] as const;

  for (const { name, Component, expectText } of cases) {
    it(`${name}: aria-busy / a11y 文言を含む skeleton を返す`, () => {
      const { container, getByText } = render(<Component />);
      const root = container.firstElementChild;
      expect(root?.getAttribute("aria-busy")).toBe("true");
      expect(getByText(new RegExp(expectText))).toBeInTheDocument();
    });
  }
});
