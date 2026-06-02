import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PropertyMapLazy } from "@/components/map/PropertyMapLazy";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

/**
 * `PropertyMapLazy` のテスト。
 *
 * `next/dynamic` の `ssr: false` ラッパは jsdom 環境では client load が走らず、
 * `loading` で指定した skeleton のみがレンダリングされる。これは本番でも
 * 「最初のフレームは skeleton → クライアントで Map をマウント」の挙動と一致するため、
 * テストでは「skeleton 要素が描画され、CLS を防ぐ最小サイズが保たれている」ことを検証する。
 */
describe("PropertyMapLazy", () => {
  it("クライアント遅延ロードまでの間、CLS を防ぐ skeleton を描画する", () => {
    const { container } = render(<PropertyMapLazy properties={MOCK_PROPERTIES} />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).not.toBeNull();
    // 最小高さ（min-h-[480px]）が当たっていること
    expect(skeleton?.className ?? "").toMatch(/min-h-\[480px\]/);
  });

  it("skeleton には CLS 抑止用の固定スタイル（pulse / border / 角丸）が当たる", () => {
    // `next/dynamic` の `loading` プロパティは props を受け取らないため、ここで検証するのは
    // 「実際の地図がマウントされる前に同サイズ・同形のプレースホルダが描画される」こと。
    const { container } = render(<PropertyMapLazy properties={MOCK_PROPERTIES} />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton?.className ?? "").toMatch(/animate-pulse/);
    expect(skeleton?.className ?? "").toMatch(/rounded-2xl/);
  });
});
