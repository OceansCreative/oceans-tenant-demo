# v1.0.0 公開前 最終チェックリスト

`demo.oceans-base.com/tenant-search` を v1.0.0 として公開する前に、本チェックリストを
**上から順に**確認してください。すべて green になった時点で、`main` を tag `v1.0.0` で
切り、GitHub Release を作成します。

所要時間目安: 30〜60 分（手動 QA 含む）。Sanity 投入と Vercel 接続が既に終わっている
前提です。初回セットアップは [docs/DEPLOYMENT.md](./DEPLOYMENT.md) を参照してください。

---

## 1. 環境変数 & 認証

Vercel ダッシュボードの **Settings → Environment Variables** を確認。

- [ ] `NEXT_PUBLIC_SANITY_PROJECT_ID` が Production / Preview に登録されている
- [ ] `NEXT_PUBLIC_SANITY_DATASET` が `production` で登録されている
- [ ] `SANITY_API_TOKEN`（書き込み用）が Production に登録されている
- [ ] `SANITY_API_READ_TOKEN`（読み取り用、任意）の有無を確認
- [ ] `ANTHROPIC_API_KEY` が Production / Preview に登録されている
- [ ] `ANTHROPIC_MODEL` が `claude-sonnet-4-5`（または明示モデル）で登録されている
- [ ] `NEXT_PUBLIC_APP_URL` が **実 URL**（`https://demo.oceans-base.com/tenant-search`）に
      なっている
- [ ] `OCEANS_BASEPATH` が `/tenant-search` に設定されている
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`（任意）の有無を確認、リファラ制限が設定されている
- [ ] Anthropic / Sanity / Google の各キーが **`NEXT_PUBLIC_` プレフィックスを誤って付与
      していない**（公開バンドルに混入しないこと）

## 2. 動作確認（ja）— 主要 6 ページ目視

実 URL `https://demo.oceans-base.com/tenant-search/` を Chrome デスクトップで開き、
日本語表示で以下が描画されることを確認。

- [ ] `/` ランディング: Hero / 特徴カード / フッターが正常に表示される
- [ ] `/search` 一覧: 物件カードが 10 件以上表示され、フィルタが効く / 地図切替が動作
- [ ] `/chat` 対話: 自然文入力 → SSE で結果が流れてくる（Anthropic Key 有効時）
- [ ] `/properties/[slug]` 詳細: 基本情報・最寄り駅・関連物件が描画される
- [ ] `/insights` ダッシュボード: KPI / 棒グラフ / ドーナツ / 賃料分布が描画される
- [ ] `/studio` Sanity Studio: iframe が読み込まれ、Desk Structure（公開中 / 交渉中 / 成約済）
      が見える

## 3. 動作確認（en）— locale 切替

- [ ] Header の `LocaleSwitcher` で `English` を選択 → `NEXT_LOCALE` cookie が `en` に変わる
- [ ] reload 後、`/` / `/search` / `/chat` / `/properties/[slug]` / `/insights` の主要文言が
      英訳に切り替わる
- [ ] `<html lang="en">` になっている（DevTools で確認）
- [ ] OG メタデータ（`og:locale`, `og:title`）が `en_US` 系に切り替わっている

## 4. モバイル動作確認

実機 or DevTools のレスポンシブモードで確認。

- [ ] iPhone Safari（375×667 〜 430×932）で `/` / `/search` / `/chat` がレイアウト崩れなし
- [ ] Android Chrome（360×800 程度）で同上
- [ ] `/search` の地図ビューがタッチ操作で破綻しない
- [ ] フィルタチップが折り返しで切れない
- [ ] Header の `LocaleSwitcher` がモバイルでも操作可能

## 5. SEO 確認

- [ ] OG 画像が取得できる: `curl -I https://demo.oceans-base.com/tenant-search/og`
- [ ] `sitemap.xml` が 200 で返る: `curl https://demo.oceans-base.com/tenant-search/sitemap.xml`
- [ ] `robots.txt` が 200 で返り、`Sitemap:` 行が**実 URL を指している**
- [ ] Twitter Card Validator / Facebook Sharing Debugger で OGP プレビューが正しく出る
      （任意、開発者ツールで `<meta property="og:*">` を目視確認でも可）
- [ ] `canonical` URL が実 URL になっている（DevTools の `<head>` で確認）

## 6. a11y 確認

- [ ] Playwright a11y E2E が CI で green（`/`, `/search`, `/chat`, `/properties/[slug]`,
      `/insights` の 5 ページで axe 違反 0）
- [ ] Tab キーのみで Header → 検索フォーム → カード → Footer まで到達できる
- [ ] フォーカスリングがすべての操作要素で可視
- [ ] スクリーンリーダ（VoiceOver / NVDA）でランドマーク（`main` / `nav` / `footer`）が
      正しく読み上げられる（任意、目視 a11y で代替可）

## 7. Lighthouse 確認

`.lighthouserc.cjs` の対象 5 URL × 3 ラン中央値で確認。

- [ ] Performance ≥ 90
- [ ] Accessibility ≥ 90
- [ ] Best Practices ≥ 90
- [ ] SEO ≥ 90
- [ ] 直近 `lighthouse.yml` workflow の最新ランが green

## 8. CI 確認

最新の `main` commit で以下がすべて green:

- [ ] `ci.yml`（lint / typecheck / vitest / Python pytest / Codecov）
- [ ] `e2e.yml`（Playwright）
- [ ] `codeql.yml`（JS/TS 静的解析）
- [ ] `lighthouse.yml`（Performance / a11y / Best Practices / SEO）
- [ ] `chromatic.yml`（視覚回帰、`CHROMATIC_PROJECT_TOKEN` 設定時）
- [ ] `eval.yml`（直近の cron / 手動 dispatch が green、または `ANTHROPIC_API_KEY` 未設定で
      mock fallback して通っている）

## 9. データ確認

- [ ] 拡充した **15〜20 件以上**の物件ドキュメントが Sanity の `production` データセットに
      投入されている（Studio から件数を確認）
- [ ] `/search` の合計件数が UI と一致する
- [ ] 公開中 / 交渉中 / 成約済 が各 1 件以上ある（Desk Structure の動作確認用）
- [ ] 投入データに **実在企業名・実在物件情報が混入していない**（架空データのみ）

## 10. セキュリティ確認

- [ ] `NEXT_PUBLIC_ADMIN_ENABLED` が **本番 Production で `false` または未設定**である
      （Admin UI を一般公開しないため）
- [ ] `ANTHROPIC_API_KEY` / `SANITY_API_TOKEN` が GitHub Actions の Repository Secrets に
      正しく格納されている（リポジトリ Settings → Secrets and variables → Actions）
- [ ] `.env.local` がリポジトリにコミットされていない（`git ls-files | grep '.env'` で確認）
- [ ] `SECURITY.md` の連絡先が最新
- [ ] CodeQL の最新ランで High / Critical の未対応 alert が 0

## 11. ドキュメント確認

- [ ] `README.md` の Live Demo リンクが **実 URL** に更新されている
      （プレースホルダ `（v1.0.0 公開予定）` が外れている）
- [ ] `CHANGELOG.md` の `[Unreleased]` を `[1.0.0] — YYYY-MM-DD` に確定
- [ ] `docs/ROADMAP.md` の v1.0.0 マイルストーン項目が Done に移動
- [ ] `docs/MIGRATION.md` に v0.x → v1.0.0 の破壊的変更（あれば）が追記
- [ ] `package.json` の `version` が `1.0.0` に更新
- [ ] `docs/SHOWCASE_BLURB.md` の demo URL / GitHub URL が実 URL になっている

---

## 仕上げ — タグ打ち & Release

すべて green を確認したら:

```bash
git checkout main
git pull
git tag -a v1.0.0 -m "v1.0.0 — 公開リファレンス実装の完成"
git push origin v1.0.0
gh release create v1.0.0 --title "v1.0.0" --notes-file release-notes-v1.0.0.md
```

タグ作成後に Vercel の Production デプロイが完走することを最後に再確認してください。
