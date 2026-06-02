import { describe, expect, it } from "vitest";
import { metadata } from "@/app/insights/page";

/**
 * /insights ページの最小スモークテスト。
 *
 * Server Component 本体は recharts の SVG measurement や next-intl の async 解決で
 * jsdom と相性が悪く、レンダリングテストは E2E 側に任せる。
 * ここでは:
 * - metadata の export 形が正しいか
 * - canonical / openGraph の URL が `/insights` を指しているか
 * を担保する。
 */
describe("/insights metadata", () => {
  it("title / description / canonical を持つ", () => {
    expect(metadata.title).toBe("物件データ可視化");
    expect(metadata.description).toMatch(/可視化/);
    expect(metadata.alternates?.canonical).toBe("/insights");
  });

  it("openGraph / twitter の URL が /insights を指す", () => {
    expect(metadata.openGraph?.url).toBe("/insights");
    expect(metadata.openGraph?.title).toBe("物件データ可視化");
    expect(metadata.twitter?.title).toBe("物件データ可視化");
  });
});
