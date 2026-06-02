# スクリーンショット

README から参照されるスクリーンショットを配置します。撮影は Playwright + sharp による自動化スクリプト
`scripts/screenshots/capture.mjs` で行い、`pnpm screenshots` で再現できます。

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
└─ mobile/    # iPhone 14 viewport、Retina ダウンサンプル
   └─ （上と同じ slug）
```

## 再撮影手順

```bash
# 1. apps/web をビルド
pnpm --filter @oceans-tenant/web build

# 2. http://localhost:3000 で next start を起動（別ターミナル）
pnpm --filter @oceans-tenant/web exec next start --port 3000

# 3. 撮影 + 最適化（sharp で PNG パレット化）
pnpm screenshots
```

撮影対象 URL とビューポートは `scripts/screenshots/capture.mjs` の `PAGES` / viewport 定義を変更します。

## 撮影ポリシー

- Mock データのみ使用。実 Sanity / Anthropic / Google Maps の鍵が未設定でも UI が成立するよう、
  `apps/web/src/lib/sanity/mock-properties.ts` の固定 5 件を表示
- 実在企業名・実在物件情報は混入させない（タイトルに「サンプル」を含む mock を撮影）
- `prefers-reduced-motion: reduce` を強制し、アニメーションのブレを抑制
- フォント `document.fonts.ready` + 0.5 秒の追加待機で文字化けを防止

## 最適化

`sharp.png({ palette: true, quality: 80, compressionLevel: 9, effort: 10 })` でパレット化。
モバイルは Retina 2x で撮影されるため、`maxWidth: 750` にダウンサンプルしています。

目安: デスクトップ < 150 KB、モバイル < 400 KB（情報量の多いページは超過することがあります）。
