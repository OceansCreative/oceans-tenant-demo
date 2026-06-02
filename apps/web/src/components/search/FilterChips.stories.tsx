import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { FilterChips } from "./FilterChips";

/**
 * 検索一覧の上部で「適用中のフィルタ」を chip 表示するクライアントコンポーネント。
 *
 * - URL クエリを唯一の状態として扱うため、Story 側は `decorators` で
 *   `window.history.replaceState` を呼び、`.storybook/mocks/next-navigation.ts` の
 *   `useSearchParams()` が読み取れる状態に仕込む。
 * - chip 0 件のときは何も描画しない仕様だが、autodocs では空状態も型ドキュメントとして
 *   有用なので "未適用" Story を残す（DOM 高さは 0）。
 *
 * 適用挙動（chip クリック → `router.replace`）はモック router の `console.info` に流れる。
 */
const meta: Meta<typeof FilterChips> = {
  title: "Search/FilterChips",
  component: FilterChips,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-neutral-200 bg-white p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FilterChips>;

/**
 * Story 描画中だけ `window.location.search` を差し替えるユーティリティ。
 * アンマウント時に元の URL に戻すため、複数 Story を切り替えても汚染しない。
 */
const useStoryQuery = (query: string): void => {
  useEffect(() => {
    const original = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
    return () => {
      window.history.replaceState(null, "", original);
    };
  }, [query]);
};

const QueryWrapper = ({ query }: { readonly query: string }): React.JSX.Element => {
  useStoryQuery(query);
  return <FilterChips />;
};

export const Applied: Story = {
  name: "条件適用済み（東京 / カフェ / 賃料上限）",
  render: () => (
    <QueryWrapper query="prefecture=%E6%9D%B1%E4%BA%AC%E9%83%BD&maxRent=600000&biz=category-cafe&buildingType=street_level" />
  ),
};

export const ManyChips: Story = {
  name: "多数 chip（折り返し確認）",
  render: () => (
    <QueryWrapper query="prefecture=%E6%9D%B1%E4%BA%AC%E9%83%BD&city=%E6%B8%8B%E8%B0%B7%E5%8C%BA&minRent=200000&maxRent=800000&minArea=20&maxArea=60&biz=category-cafe&biz=category-restaurant&condition=skeleton&q=%E3%82%AB%E3%83%95%E3%82%A7" />
  ),
};
