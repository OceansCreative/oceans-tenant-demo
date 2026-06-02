# スクリーンショット / 操作デモ

README から参照される静止画（PNG）と操作デモ（GIF）を配置します。
撮影は Playwright を使った自動化スクリプトで再現可能です。

- 静止画: `scripts/screenshots/capture.mjs`（sharp で PNG 最適化）→ `pnpm screenshots`
- GIF: `scripts/screenshots/capture-gif.mjs`（ffmpeg palettegen / paletteuse）→ `pnpm screenshots:gif`

## 構成

```text
docs/images/
├─ desktop/   # 1440x900、PNG パレット化済み
│  ├─ landing.png
│  ├─ search.png
│  ├─ property-detail.png
│  ├─ chat.png
│  ├─ agent.png
│  └─ agent-ingest.png
├─ mobile/    # iPhone 14 viewport、Retina ダウンサンプル
│  └─ （上と同じ slug）
└─ demos/    # 1280x720 / 15fps / 無限ループの GIF
   ├─ search-filter.gif   # /search のフィルタ操作
   ├─ ai-chat.gif         # /chat の自然言語 → 結果配信
   └─ url-ingest.gif      # /agent/ingest の AI 抽出
```

## 再撮影手順（静止画 PNG）

```bash
# 1. apps/web をビルド
pnpm --filter @oceans-tenant/web build

# 2. http://localhost:3000 で next start を起動（別ターミナル）
pnpm --filter @oceans-tenant/web exec next start --port 3000

# 3. 撮影 + 最適化（sharp で PNG パレット化）
pnpm screenshots
```

撮影対象 URL とビューポートは `scripts/screenshots/capture.mjs` の `PAGES` / viewport 定義を変更します。

## 再撮影手順（操作デモ GIF）

```bash
# 1. apps/web をビルド
pnpm --filter @oceans-tenant/web build

# 2. http://localhost:3000 で next start を起動（別ターミナル）
pnpm --filter @oceans-tenant/web exec next start --port 3000

# 3. GIF 撮影（全 3 本）
pnpm screenshots:gif

# 1 本だけ撮り直したいとき
pnpm screenshots:gif -- --only=search-filter
pnpm screenshots:gif -- --only=ai-chat
pnpm screenshots:gif -- --only=url-ingest
```

GIF 撮影は外部 API 鍵を必要としません。`/api/chat-search`・`/api/ingest-url` への通信は
Playwright の `page.route` でモック応答に差し替えています（`capture-gif.mjs` 内で定義）。

## 撮影ポリシー

- Mock データのみ使用。実 Sanity / Anthropic / Google Maps の鍵が未設定でも UI が成立するよう、
  `apps/web/src/lib/sanity/mock-properties.ts` の固定 5 件を表示
- 実在企業名・実在物件情報は混入させない（タイトルに「サンプル」を含む mock を撮影）
- `prefers-reduced-motion: reduce` を強制し、アニメーションのブレを抑制
- フォント `document.fonts.ready` + 0.5 秒の追加待機で文字化けを防止

## 最適化

### PNG
`sharp.png({ palette: true, quality: 80, compressionLevel: 9, effort: 10 })` でパレット化。
モバイルは Retina 2x で撮影されるため、`maxWidth: 750` にダウンサンプルしています。

目安: デスクトップ < 150 KB、モバイル < 400 KB（情報量の多いページは超過することがあります）。

### GIF
ffmpeg の 2 パスエンコード（palettegen `stats_mode=diff` → paletteuse `dither=bayer` /
`diff_mode=rectangle`）を採用。`@ffmpeg-installer/ffmpeg` がバイナリを同梱するため、
追加の手動セットアップ不要で macOS / Linux のいずれでも動作します。

目安: 各 GIF < 500 KB（CI には乗せないため、手元で実行する前提）。
