/**
 * サイト全体で参照する定数。
 * 実在企業名・営業文脈・クライアント情報を含めないこと（CLAUDE.md）。
 */
export const SITE_CONFIG = {
  name: "OceansTenant",
  tagline: "AI で店舗物件を探す、登録する",
  description:
    "URL をペーストするだけで AI が物件情報を構造化抽出。自然言語での対話型検索と地図ビューで、店舗物件マッチングを次の段階へ。",
  navigation: [
    { href: "/", label: "ホーム" },
    { href: "/search", label: "物件を探す" },
    { href: "/chat", label: "対話で探す" },
    { href: "/agent", label: "不動産会社" },
  ],
  footer: {
    sections: [
      {
        title: "サービス",
        links: [
          { href: "/search", label: "物件検索" },
          { href: "/chat", label: "対話型検索" },
        ],
      },
      {
        title: "事業者向け",
        links: [
          { href: "/agent", label: "不動産会社ポータル" },
          { href: "/agent/ingest", label: "URL からの登録" },
        ],
      },
      {
        title: "プロジェクト",
        links: [
          { href: "https://github.com/OceansCreative/oceans-tenant-demo", label: "GitHub" },
          { href: "/docs/architecture", label: "アーキテクチャ" },
        ],
      },
    ],
    copyright: `© ${new Date().getFullYear()} OceansBase — リファレンス実装`,
  },
} as const;

export type NavigationItem = (typeof SITE_CONFIG.navigation)[number];
