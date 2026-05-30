# スクリーンショット / GIF

このディレクトリには README とドキュメントで使うスクリーンショット・GIF を配置します。

## 撮影予定リスト（v0.1.1 で確定）

| ファイル | 用途 | サイズ目標 |
|---|---|---|
| `landing.png` | ランディングページ | 1440×960、200KB 以下 |
| `search-list.png` | /search 一覧ビュー | 1440×960、200KB 以下 |
| `search-map.png` | /search 地図ビュー | 1440×960、250KB 以下 |
| `chat.gif` | /chat の対話 1 往復 | 800×600、500KB 以下 |
| `ingest.gif` | URL 投入 → AI 抽出 → プレビュー | 800×600、500KB 以下 |
| `property-detail.png` | 物件詳細ページ | 1440×960、200KB 以下 |
| `mobile-search.png` | モバイル view | 414×896 |

## 最適化

```bash
# PNG: pngquant 90%
pngquant --quality=70-90 --strip --output landing.png landing.raw.png
# GIF: gifsicle で減色とフレームレート
gifsicle -O3 --colors 128 chat.raw.gif > chat.gif
```

## 撮影手順（参考）

1. `pnpm dev` でローカル起動（実 Sanity / Anthropic / Maps 鍵を `.env.local` に設定）
2. seed スクリプトでダミーデータ投入
3. macOS の Screenshot.app（⌘⇧4）で領域指定撮影、または Cleanshot X
4. GIF は Kap で撮影、gifsicle で最適化
5. このディレクトリに配置し README.md / docs/ から参照

## 未配置時の挙動

README は画像ファイル不存在時もテキストフォールバックで読めるよう書いています。
