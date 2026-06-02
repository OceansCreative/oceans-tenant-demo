import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import type { AxeMatchers } from "vitest-axe";
// vitest-axe@0.1.0 の `extend-expect` エントリは空 JS のため、`matchers` から直接マッチャを取り出し
// `expect.extend` で登録する。型側は `Vi.Assertion` を `vitest-axe` の AxeMatchers でモジュール拡張する。
import * as axeMatchers from "vitest-axe/matchers";

expect.extend(axeMatchers);

afterEach(() => {
  cleanup();
});

declare module "vitest" {
  // vitest-axe が提供する Assertion 拡張を取り込む（toHaveNoViolations を `expect()` 上で型認識させる）。
  interface Assertion<T = unknown> extends AxeMatchers {
    _phantom?: T;
  }
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
