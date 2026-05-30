"""ダミーデータ生成ロジック。

- 東京 / 大阪 / 福岡 の 3 エリアに正規分布で物件を配置
- 実在企業名・実在物件情報は使わない（ジェネリックな業態名 + faker）
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

UTC = timezone.utc

from faker import Faker

from .models import (
    Address,
    Geopoint,
    NearestStation,
    PropertyDraft,
    RealEstateCompanyDraft,
)


# 主要 3 エリアの中心座標。lat/lng 標準偏差は約 ±2km スケール
AREA_CENTERS: dict[str, dict] = {
    "tokyo": {
        "prefecture": "東京都",
        "city_choices": ("新宿区", "渋谷区", "港区", "千代田区", "中央区"),
        "center": (35.689, 139.692),
        "stddev": (0.02, 0.025),
        "lines": ("JR 山手線", "東京メトロ丸ノ内線", "東京メトロ銀座線", "都営大江戸線"),
    },
    "osaka": {
        "prefecture": "大阪府",
        "city_choices": ("大阪市北区", "大阪市中央区", "大阪市浪速区", "大阪市西区"),
        "center": (34.702, 135.500),
        "stddev": (0.018, 0.022),
        "lines": ("Osaka Metro 御堂筋線", "Osaka Metro 中央線", "JR 環状線", "阪急神戸線"),
    },
    "fukuoka": {
        "prefecture": "福岡県",
        "city_choices": ("福岡市博多区", "福岡市中央区", "福岡市早良区"),
        "center": (33.589, 130.420),
        "stddev": (0.02, 0.024),
        "lines": ("福岡市営地下鉄空港線", "西鉄天神大牟田線", "JR 鹿児島本線"),
    },
}

_BUILDING_TYPES = (
    "street_level",
    "building_inline",
    "second_floor_or_above",
    "basement",
    "stand_alone",
    "other",
)
_CONDITIONS = ("skeleton", "second_hand", "transferable_fixtures")
_AVAILABILITIES = ("public", "negotiating", "closed")
_AVAILABILITY_WEIGHTS = (80, 15, 5)  # public が主

_FEATURE_POOL = (
    "スケルトン",
    "居抜き",
    "造作譲渡",
    "天井高 3m",
    "重飲食可",
    "深夜営業可",
    "ダクト有",
    "電源 200V",
    "ガラス面広",
    "視認性高",
    "駅徒歩 5 分以内",
    "1 階路面",
    "コーナー立地",
    "看板設置可",
    "禁煙",
)

_BUSINESS_CATEGORY_REFS = (
    "category-cafe",
    "category-restaurant",
    "category-bar",
    "category-retail",
    "category-beauty",
    "category-office",
    "category-fitness",
    "category-clinic",
)

_GENERIC_COMPANY_PATTERNS = (
    "サンプル",
    "デモ",
    "リファレンス",
    "テナント",
    "プレイス",
)


def _build_address(area_key: str, rng: random.Random) -> tuple[Address, str]:
    area = AREA_CENTERS[area_key]
    lat = rng.gauss(area["center"][0], area["stddev"][0])
    lng = rng.gauss(area["center"][1], area["stddev"][1])
    # クランプして範囲外を回避
    lat = max(20.001, min(45.999, lat))
    lng = max(122.001, min(153.999, lng))
    city = rng.choice(area["city_choices"])
    address = Address(
        prefecture=area["prefecture"],
        city=city,
        streetAddress=f"{rng.randint(1, 9)}-{rng.randint(1, 30)}-{rng.randint(1, 20)}",
        buildingName=None,
        roomNumber=None,
        geopoint=Geopoint(lat=round(lat, 6), lng=round(lng, 6)),
    )
    line = rng.choice(area["lines"])
    return address, line


def generate_real_estate_companies(
    count: int = 5,
    seed: int = 0,
) -> list[RealEstateCompanyDraft]:
    """ダミー不動産会社を生成する。

    実在企業名を絶対に含めないため、`_GENERIC_COMPANY_PATTERNS` のみから合成する。
    """
    rng = random.Random(seed)
    fake_ja = Faker("ja_JP")
    fake_ja.seed_instance(seed)
    companies: list[RealEstateCompanyDraft] = []
    for index in range(count):
        pattern = rng.choice(_GENERIC_COMPANY_PATTERNS)
        suffix = rng.choice(("不動産", "プロパティ", "リアルティ", "エステート"))
        name = f"{pattern}{suffix}株式会社"
        slug = f"sample-realty-{index + 1:03d}"
        license_no = (
            f"{rng.choice(('東京都', '大阪府', '福岡県'))}知事"
            f"({rng.randint(1, 9)})第{rng.randint(10000, 99999)}号"
        )
        companies.append(
            RealEstateCompanyDraft(
                name=name,
                slug=slug,
                description=f"これは公開 OSS リファレンス実装のためのダミー会社 #{index + 1} です。",
                contactEmail=f"info-{index + 1:03d}@example.com",
                contactPhone=f"0{rng.randint(3, 9)}-{rng.randint(1000, 9999)}-{rng.randint(1000, 9999)}",
                licenseNumber=license_no,
                representativeName=fake_ja.name(),
                websiteUrl=f"https://example.com/realty-{index + 1:03d}",
            )
        )
    return companies


def generate_properties(
    count: int = 50,
    seed: int = 0,
    company_count: int = 5,
) -> list[PropertyDraft]:
    """ダミー物件を生成する。

    - 東京 / 大阪 / 福岡 にランダムに配置（重み: 5:3:2）
    - 各エリア内で正規分布
    - listedByRef は company-001 〜 company-{N} を割り当て
    """
    rng = random.Random(seed)
    fake_ja = Faker("ja_JP")
    fake_ja.seed_instance(seed)
    area_keys = list(AREA_CENTERS.keys())
    area_weights = [5, 3, 2]  # tokyo / osaka / fukuoka
    base_dt = datetime(2026, 1, 1, tzinfo=UTC)
    properties: list[PropertyDraft] = []
    for index in range(count):
        area_key = rng.choices(area_keys, weights=area_weights, k=1)[0]
        address, line = _build_address(area_key, rng)
        area_value = round(rng.uniform(15.0, 220.0), 2)
        rent = int(round(area_value * rng.uniform(8000, 22000) / 100) * 100)
        building_type = rng.choice(_BUILDING_TYPES)
        condition = rng.choice(_CONDITIONS)
        availability = rng.choices(_AVAILABILITIES, weights=_AVAILABILITY_WEIGHTS, k=1)[0]
        # 特徴をランダムに 1〜5 個サンプリング（重複なし）
        features = rng.sample(_FEATURE_POOL, k=rng.randint(1, 5))
        # 業種 1〜3 個
        biz_refs = rng.sample(_BUSINESS_CATEGORY_REFS, k=rng.randint(1, 3))
        # 駅 1〜2 個
        stations = [
            NearestStation(
                line=line,
                station=fake_ja.last_name() + "駅",
                walkMinutes=rng.randint(1, 12),
            )
        ]
        if rng.random() < 0.6:
            stations.append(
                NearestStation(
                    line=line,
                    station=fake_ja.last_name() + "駅",
                    walkMinutes=rng.randint(2, 15),
                )
            )
        listed_by_index = rng.randint(1, company_count)
        ai_extracted = rng.random() < 0.3
        ai_confidence = round(rng.uniform(0.6, 0.98), 3) if ai_extracted else None
        published = base_dt + timedelta(days=rng.randint(0, 120))
        properties.append(
            PropertyDraft(
                title=f"{address.city} {area_value:.0f}㎡の{_japanese_label_for_building(building_type)}",
                slug=f"sample-property-{index + 1:04d}",
                address=address,
                nearestStations=stations,
                rent=rent,
                commonFee=int(rent * rng.uniform(0.04, 0.08)),
                depositMonths=float(rng.choice((1, 2, 3, 6, 10))),
                keyMoneyMonths=float(rng.choice((0, 1, 2))),
                area=area_value,
                floor=f"{rng.choice(('B1', '1', '2', '3', '4', '5'))} 階",
                buildingType=building_type,
                condition=condition,
                previousBusiness=None if rng.random() < 0.4 else rng.choice(("カフェ", "美容室", "オフィス", "物販")),
                suitableBusinessRefs=biz_refs,
                description=f"これは公開 OSS リファレンス実装のためのダミー物件 #{index + 1} です。",
                features=features,
                availability=availability,
                listedByRef=f"company-{listed_by_index:03d}",
                sourceUrl=f"https://example.com/listings/{index + 1:04d}" if ai_extracted else None,
                aiExtracted=ai_extracted,
                aiConfidence=ai_confidence,
                publishedAt=published.isoformat().replace("+00:00", "Z"),
            )
        )
    return properties


def _japanese_label_for_building(value: str) -> str:
    """テスト・タイトル生成用の最低限の日本語ラベル。"""
    mapping = {
        "street_level": "路面店",
        "building_inline": "ビルイン店舗",
        "second_floor_or_above": "2 階以上の店舗",
        "basement": "地下店舗",
        "stand_alone": "独立店舗",
        "other": "店舗",
    }
    return mapping[value]
