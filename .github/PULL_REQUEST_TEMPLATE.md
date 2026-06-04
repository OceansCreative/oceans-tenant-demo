<!--
  PR タイトルは Conventional Commits 形式で書いてください。
  例: feat(web): 物件カードコンポーネントを実装
-->

## 概要

<!-- この PR が何をするのか、なぜするのかを 2〜3 文で書いてください。 -->

## 変更点

<!-- 主な変更を箇条書きで書いてください。 -->

- 

## 関連 Issue

<!-- 必ず `Closes #N` または `Refs #N` を含めてください。 -->

Closes #

## テスト

<!-- どのように検証したか、`pnpm test` / `pnpm typecheck` / `pnpm lint` の結果などを記載してください。 -->

- [ ] `pnpm lint` を実行し成功
- [ ] `pnpm typecheck` を実行し成功
- [ ] `pnpm test` を実行し成功
- [ ] 影響範囲のテストを追加・更新済み

## スクリーンショット / 動作確認

<!-- UI 変更がある場合はビフォー / アフターのスクリーンショットや GIF を貼ってください。不要な場合は削除可。 -->

## 品質確認チェックリスト

<!-- UI / 翻訳 / a11y / Performance に該当する場合のみ。該当しない項目は除去または✕で残しても可。 -->

- [ ] **a11y**: axe 違反 0 を維持（`apps/web/src/tests/a11y/`）
- [ ] **Lighthouse**: 主要ページで Performance / Accessibility / Best Practices / SEO すべて 90+ を維持
- [ ] **翻訳キー**: 新規 UI 文言がある場合、`messages/{ja,en}.json` の両方を更新（[CONTRIBUTING.md の翻訳キー追加手順](../CONTRIBUTING.md#翻訳キー追加手順) を参照）
- [ ] **Storybook**: 新規コンポーネントは story を追加（`apps/web/src/**/*.stories.tsx`）
- [ ] **Chromatic**: 視覚回帰 0、または意図した差分のみ
- [ ] **互換性**: 公開 API（`packages/shared` の export、UI コンポーネントの Props）に破壊的変更がある場合は [docs/MIGRATION.md](../docs/MIGRATION.md) に追記

## チェックリスト

- [ ] 1 PR = 1 論理単位になっている
- [ ] コミットメッセージが Conventional Commits 形式
- [ ] [CLAUDE.md](../CLAUDE.md) / [docs/spec.md](../docs/spec.md) の規約に準拠
- [ ] 秘密情報・実在企業名・実在物件情報を含まない
- [ ] CI（lint / typecheck / test / CodeQL / Lighthouse / Chromatic）がグリーンであること

## レビュアーへの依頼事項

<!-- 特に確認してほしい観点があれば書いてください。 -->
