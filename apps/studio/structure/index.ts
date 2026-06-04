import { availabilityLabel, availabilityValues } from "@oceans-tenant/shared";
import type { StructureBuilder } from "sanity/structure";

/**
 * Sanity Studio のカスタム Desk Structure。
 *
 * 物件ドキュメントを `availability`（公開状態）ごとにグルーピング表示する。
 * 標準のフラットなドキュメントタイプ一覧では編集者が「公開中の物件だけ見たい」
 * といった頻出ワークフローを満たしにくいため、Phase 2（v0.10.0 WS-4）で
 * カスタム構造を導入した。
 *
 * 階層:
 *   コンテンツ
 *   ├─ 物件
 *   │  ├─ 公開中 / 商談中 / 成約（availability でフィルタ）
 *   │  └─ 全物件（標準ドキュメントリスト）
 *   ├─ 不動産会社
 *   ├─ 業態カテゴリ
 *   ├─ エリア
 *   └─ 検索セッション（履歴）
 *
 * availability の取りうる値とラベルは `@oceans-tenant/shared` の単一の真実から
 * 取得し、enum を変更した際に Studio 表示が自動追随するようにしている。
 */
export const structure = (S: StructureBuilder) =>
  S.list()
    .title("コンテンツ")
    .items([
      S.listItem()
        .id("property-group")
        .title("物件")
        .child(
          S.list()
            .title("物件 - ステータス別")
            .items([
              ...availabilityValues.map((value) =>
                S.listItem()
                  .id(`property-${value}`)
                  .title(availabilityLabel[value])
                  .child(
                    S.documentTypeList("property")
                      .title(`${availabilityLabel[value]}の物件`)
                      .filter('_type == "property" && availability == $availability')
                      .params({ availability: value })
                      .defaultOrdering([{ field: "publishedAt", direction: "desc" }]),
                  ),
              ),
              S.divider(),
              S.documentTypeListItem("property").title("全物件"),
            ]),
        ),
      S.divider(),
      S.documentTypeListItem("realEstateCompany").title("不動産会社"),
      S.documentTypeListItem("businessCategory").title("業態カテゴリ"),
      S.documentTypeListItem("area").title("エリア"),
      S.divider(),
      S.documentTypeListItem("searchSession").title("検索セッション（履歴）"),
    ]);
