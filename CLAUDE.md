# OceansTenant — Claude Code 開発規約

## プロジェクト目的

店舗物件検索プラットフォームのリファレンス実装をOSSとして公開する。
AI連携・構造化データ管理・対話型UXの実装例として参照可能にすることを目的とする。

詳細仕様は [docs/spec.md](docs/spec.md) を参照。

## 開発原則

1. すべてのコードはTypeScript strict modeに準拠
2. `any` 禁止、`unknown` で受けて型ガードを書く
3. すべての文言・コメント・コミット・PR・Issueは日本語
4. AI連携部分はAPI Route経由（クライアント直叩き禁止）
5. APIキー・秘密情報は絶対にコミットしない（pre-commitフックで検出）
6. PRには必ず対応テストを含める
7. 機能PRは必ずIssueに紐付ける

## コミット規約

Conventional Commits（日本語可）

- `feat(web): 物件詳細ページを実装`
- `fix(api): URL抽出のタイムアウト処理を修正`
- `test(web): 検索フィルタのユニットテスト追加`
- `docs: アーキテクチャ図を追加`
- `chore(deps): Next.jsを15.1.0に更新`

## ブランチ戦略

- `main`: 常にデプロイ可能
- `feat/<issue-番号>-<概要>`: 機能開発
- `fix/<issue-番号>-<概要>`: バグ修正
- `chore/<issue-番号>-<概要>`: 設定・整備
- `docs/<issue-番号>-<概要>`: ドキュメント

## PR規約

- タイトル: Conventional Commits 形式
- 本文テンプレートに従う（`.github/PULL_REQUEST_TEMPLATE.md`）
- 必ず `Closes #N` で Issue を閉じる
- CI グリーン必須
- 1 PR = 1 論理単位（diff は小さく保つ）

## サブエージェント活用

`.claude/agents/` 配下のエージェントを適宜起動する。

## 禁止事項

- `localStorage` / `sessionStorage` の使用
- 認証実装（NextAuth等）
- 課金実装
- クライアント情報・営業文脈の記述
- 実在企業名・実在物件情報の混入
