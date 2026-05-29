# コントリビュートガイド

OceansTenant への貢献に興味を持っていただきありがとうございます。
このプロジェクトは AI 連携・構造化データ管理・対話型 UX を統合した OSS リファレンス実装を目的としています。

## はじめに

- 本プロジェクトの目的・原則は [CLAUDE.md](./CLAUDE.md) を参照してください。
- 詳細な仕様は [docs/spec.md](./docs/spec.md) にあります。
- 行動規範は [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) を参照してください。

## 開発環境

| ツール | バージョン | 備考 |
|---|---|---|
| Node.js | 20.x LTS | `.nvmrc` に固定 |
| pnpm | 9.15.4 | `packageManager` に固定。`corepack prepare pnpm@9.15.4 --activate` で有効化可能 |
| Python | 3.12 | `scripts/python/` のみで使用 |

### 初回セットアップ

```bash
git clone https://github.com/OceansCreative/oceans-tenant-demo.git
cd oceans-tenant-demo
pnpm install
cp .env.example .env.local
```

## ブランチ戦略

- `main`: 常にデプロイ可能。直接 push 禁止
- `feat/<issue-番号>-<概要>`: 機能開発
- `fix/<issue-番号>-<概要>`: バグ修正
- `chore/<issue-番号>-<概要>`: 設定・整備
- `docs/<issue-番号>-<概要>`: ドキュメント
- `test/<issue-番号>-<概要>`: テスト追加

## コミット規約

[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) に従ってください。日本語可。

| Type | 用途 |
|---|---|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `refactor` | 動作を変えないリファクタ |
| `perf` | パフォーマンス改善 |
| `test` | テスト追加・修正 |
| `docs` | ドキュメントのみ |
| `chore` | ビルド・設定・運用 |
| `ci` | CI/CD 関連 |
| `style` | フォーマットのみ |
| `revert` | 取り消し |

例:
```
feat(web): 物件詳細ページに地図を埋め込み
fix(api): URL 抽出のタイムアウト処理を修正
chore(deps): Next.js を 15.1.0 に更新
```

`commit-msg` フックで commitlint が走るため、規約違反のコミットはローカルで弾かれます。

## Pull Request

1. Issue を起票し、対応する `feat/<番号>-...` ブランチを切る
2. **1 PR = 1 論理単位**、コミットは小刻みに刻む（1 コミット = 1 論理単位）
3. テンプレート（`.github/PULL_REQUEST_TEMPLATE.md`）を埋める
4. 必ず `Closes #N` で Issue を閉じる
5. CI（lint / typecheck / test / CodeQL）がグリーンであること
6. セルフレビューを経て、オーナーへレビュー依頼

## テスト

| コマンド | 内容 |
|---|---|
| `pnpm lint` | Biome による lint |
| `pnpm format` | Biome による format |
| `pnpm typecheck` | 全ワークスペースで `tsc --noEmit` |
| `pnpm test` | 全ワークスペースの Vitest |
| `pnpm test:coverage` | カバレッジ付き実行 |

機能 PR には対応するテストを必ず含めてください。

## 禁止事項

CLAUDE.md と同様、以下を含む変更は受け入れません。

- `localStorage` / `sessionStorage` の使用
- 認証実装（NextAuth 等）
- 課金実装
- クライアント情報・営業文脈・実在企業名・実在物件情報の混入
- 秘密情報（`.env`、API キー）のコミット

## セキュリティ

脆弱性の報告は [SECURITY.md](./SECURITY.md) に従い、Issue ではなく Security Advisory として private に報告してください。

## 質問

機能要望以外の議論や使い方の質問は GitHub Discussions をご利用ください。
