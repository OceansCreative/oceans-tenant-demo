# コントリビュートガイド

OceansTenant への貢献に興味を持っていただきありがとうございます。
このプロジェクトは AI 連携・構造化データ管理・対話型 UX を統合した OSS リファレンス実装を目的としています。

## はじめに

- 本プロジェクトの目的・原則は [CLAUDE.md](./CLAUDE.md) を参照してください。
- 詳細な仕様は [docs/spec.md](./docs/spec.md) にあります。
- 行動規範は [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) を参照してください。
- ロードマップは [docs/ROADMAP.md](./docs/ROADMAP.md)、互換性ガイドは [docs/MIGRATION.md](./docs/MIGRATION.md) を参照してください。

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

env 未設定でも mock fallback でローカルは動きます。実 AI / Sanity 連携が必要な場合のみ env を設定してください。

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

### commitlint ルール

`commit-msg` フックで commitlint が走るため、規約違反のコミットはローカルで弾かれます（[commitlint.config.mjs](./commitlint.config.mjs)）。
主なルール:

| ルール | 値 |
|---|---|
| `header-max-length` | 100 |
| `type-enum` | 上記 11 種 |
| `subject-empty` | 禁止 |
| `type-empty` | 禁止 |

## Pull Request

### 標準フロー

1. Issue を起票し、対応する `feat/<番号>-...` ブランチを切る
2. **1 PR = 1 論理単位**、コミットは小刻みに刻む（1 コミット = 1 論理単位）
3. テンプレート（[.github/PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md)）を埋める
4. 必ず `Closes #N` で Issue を閉じる
5. CI（lint / typecheck / test / CodeQL / Lighthouse / Chromatic）がグリーンであること
6. セルフレビューを経て、オーナーへレビュー依頼

### PR チェックリスト

PR 作成時にテンプレート末尾のチェックリストを埋めてください。要点は以下:

- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` がローカルで green
- [ ] 影響範囲のテストを追加・更新済み（機能 PR はテスト同梱必須）
- [ ] `Closes #N` で Issue を閉じている
- [ ] UI 変更がある場合: ビフォー / アフターのスクリーンショット、a11y（axe）違反 0、Lighthouse 90+ を確認
- [ ] 翻訳キーを追加した場合: `messages/{ja,en}.json` の両方を更新、未使用キーが無い
- [ ] 秘密情報・実在企業名・実在物件情報を含まない
- [ ] 1 PR = 1 論理単位になっている

### `/ship` パターンによる並列開発

リリース粒度の大きな機能投入では、worktree 分離サブエージェントで複数ワークストリーム（WS-1 / WS-2 / WS-3）を **同時着手** する `/ship` パターンを採用しています。

- 親エージェント（オーケストレーター）はゴール分割と PR レビューに徹し、実装は子エージェントが worktree 内で完結させる
- 各子エージェントは独立した worktree（`.claude/worktrees/agent-<hash>/`）でブランチを切り、PR まで自走する
- 親は CI green を確認しながら PR #1 → #2 → #3 の順にマージ。`pnpm-lock.yaml` 等の競合は `git checkout --theirs` + `pnpm install` 再生成で都度解消
- リリースノートは [Workflow tool](https://docs.claude.com/en/docs/claude-code/workflows) で並列サーベイから生成（過去 8 サイクル / Workflow 3 サイクル実施）

`/ship` を起動するのは原則オーナー（kazushi6111）のみですが、外部コントリビューターも同等の並列度で PR を分割する場合に参考にしてください。

## 翻訳キー追加手順

v0.8.0 で `next-intl` を導入し、v0.9.0 で全画面が翻訳キー経由になりました。新規 UI 文言を追加する場合は以下を守ってください。

### 1. メッセージファイルに追加

`apps/web/messages/ja.json` と `apps/web/messages/en.json` の **両方** に同じキー構造で追加します。

```json
// messages/ja.json
{
  "search": {
    "newKey": "新しい文言"
  }
}

// messages/en.json
{
  "search": {
    "newKey": "New message"
  }
}
```

### 2. コンポーネントから参照

```tsx
"use client";
import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations("search");
  return <p>{t("newKey")}</p>;
}
```

Server Component の場合は `getTranslations` を使います。

```tsx
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("search");
  return <h1>{t("newKey")}</h1>;
}
```

### 3. テスト

`renderWithI18n` helper（`apps/web/src/tests/helpers/i18n.tsx`）でラップしてください。

```tsx
import { renderWithI18n } from "@/tests/helpers/i18n";

it("ja の文言が出る", () => {
  renderWithI18n(<MyComponent />, { locale: "ja" });
  expect(screen.getByText("新しい文言")).toBeInTheDocument();
});

it("en の文言が出る", () => {
  renderWithI18n(<MyComponent />, { locale: "en" });
  expect(screen.getByText("New message")).toBeInTheDocument();
});
```

### 4. enum 系の文言

建物形態 / 物件状態 / availability 等の enum ラベルは `lib/i18n/enum-labels.ts` に集約しています。
新規 enum を追加する場合はそこに locale 別マップを追加し、`useEnumLabelLookup()` 経由で取得してください。

詳細は [docs/MIGRATION.md](./docs/MIGRATION.md#22-enum-翻訳-helper-の導入v090-で発生) を参照。

## テスト

| コマンド | 内容 |
|---|---|
| `pnpm lint` | Biome による lint |
| `pnpm format` | Biome による format |
| `pnpm typecheck` | 全ワークスペースで `tsc --noEmit` |
| `pnpm test` | 全ワークスペースの Vitest + scripts/eval の node:test |
| `pnpm test:coverage` | カバレッジ付き実行 |
| `pnpm --filter @oceans-tenant/web exec playwright test` | Playwright E2E |
| `pnpm --filter oceans-tenant-eval run eval:mock` | AI 抽出評価ハーネス（mock） |

機能 PR には対応するテストを必ず含めてください。

### 品質ゲート

| 指標 | 目標 | CI で fail させるか |
|---|---|---|
| vitest pass | 100% | はい |
| typecheck | error 0 | はい |
| biome lint | error 0 | はい |
| coverage Lines | 70% | いいえ（warning） |
| Lighthouse Performance | 90+ | いいえ（warning） |
| axe violations | 0 | はい |
| Chromatic | 視覚回帰 0 | レビュー必須（auto-accept なし） |
| eval overallScore | 0.6 | はい（実 Claude 実行時のみ） |

## 禁止事項

[CLAUDE.md](./CLAUDE.md) と同様、以下を含む変更は受け入れません。

- `localStorage` / `sessionStorage` の使用
- 認証実装（NextAuth 等）
- 課金実装
- クライアント情報・営業文脈・実在企業名・実在物件情報の混入
- 秘密情報（`.env`、API キー）のコミット

スコープ境界の詳細は [docs/ROADMAP.md](./docs/ROADMAP.md) の「v1.x 以降の構想（OSS スコープ外）」を参照してください。

## セキュリティ

脆弱性の報告は [SECURITY.md](./SECURITY.md) に従い、Issue ではなく Security Advisory として private に報告してください。

## 質問

機能要望以外の議論や使い方の質問は GitHub Discussions をご利用ください。

- バグ報告: [.github/ISSUE_TEMPLATE/bug_report.yml](./.github/ISSUE_TEMPLATE/bug_report.yml)
- 機能要望: [.github/ISSUE_TEMPLATE/feature_request.yml](./.github/ISSUE_TEMPLATE/feature_request.yml)
- 脆弱性: [GitHub Security Advisories](https://github.com/OceansCreative/oceans-tenant-demo/security/advisories/new)
