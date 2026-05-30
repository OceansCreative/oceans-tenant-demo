"""ジェネレータの決定論性・分布・実在企業名混入チェック。"""
from __future__ import annotations

from collections import Counter

import pytest

from oceans_tenant_seed import (
    AREA_CENTERS,
    generate_properties,
    generate_real_estate_companies,
)

# 仕様上、絶対に含めてはならない既知の実在企業名キーワードの最小ブラックリスト
_FORBIDDEN_BRAND_KEYWORDS = (
    "三井",
    "三菱",
    "住友",
    "野村",
    "東急",
    "大東建託",
    "アパマン",
    "エイブル",
    "minimini",
    "ミニミニ",
    "leopalace",
    "レオパレス",
)


def test_generate_properties_default_count() -> None:
    properties = generate_properties(seed=42)
    assert len(properties) == 50


def test_generate_properties_is_deterministic_with_same_seed() -> None:
    a = generate_properties(count=10, seed=123)
    b = generate_properties(count=10, seed=123)
    assert [p.title for p in a] == [p.title for p in b]
    assert [p.address.geopoint.lat for p in a] == [
        p.address.geopoint.lat for p in b
    ]


def test_generate_properties_distribution_covers_three_major_areas() -> None:
    properties = generate_properties(count=200, seed=7)
    prefectures = Counter(p.address.prefecture for p in properties)
    # 3 主要エリアすべてが出現していること
    assert prefectures["東京都"] >= 1
    assert prefectures["大阪府"] >= 1
    assert prefectures["福岡県"] >= 1
    # それ以外の都道府県は混じらない
    assert set(prefectures.keys()) <= {"東京都", "大阪府", "福岡県"}


def test_generate_properties_geopoint_clamped_to_japan_range() -> None:
    properties = generate_properties(count=200, seed=11)
    for prop in properties:
        assert 20.0 <= prop.address.geopoint.lat <= 46.0
        assert 122.0 <= prop.address.geopoint.lng <= 154.0


def test_generate_properties_geopoint_near_area_center() -> None:
    """各物件の座標が登録エリア中心から 0.2 度以内に収まること（≒ 22km）。"""
    properties = generate_properties(count=200, seed=21)
    for prop in properties:
        match_area = next(
            area
            for area in AREA_CENTERS.values()
            if area["prefecture"] == prop.address.prefecture
        )
        center_lat, center_lng = match_area["center"]
        assert abs(prop.address.geopoint.lat - center_lat) <= 0.2
        assert abs(prop.address.geopoint.lng - center_lng) <= 0.2


@pytest.mark.parametrize(
    "field",
    ["title", "description"],
)
def test_generate_properties_does_not_leak_real_brand_names(field: str) -> None:
    properties = generate_properties(count=100, seed=4242)
    for prop in properties:
        text = (getattr(prop, field) or "").lower()
        for keyword in _FORBIDDEN_BRAND_KEYWORDS:
            assert keyword.lower() not in text, (
                f"フィールド {field} に実在企業名と疑われるキーワード {keyword} が含まれています: {text}"
            )


def test_generate_real_estate_companies_default_count() -> None:
    companies = generate_real_estate_companies(seed=42)
    assert len(companies) == 5
    for company in companies:
        assert company.name.endswith("株式会社")
        # 実在企業名キーワード混入チェック
        for keyword in _FORBIDDEN_BRAND_KEYWORDS:
            assert keyword.lower() not in company.name.lower()


def test_generate_real_estate_companies_license_format() -> None:
    import re

    pattern = re.compile(r"^[^()（）\s]+(?:知事|大臣)[(（]\d{1,3}[)）]第\d{1,6}号$")
    companies = generate_real_estate_companies(count=20, seed=0)
    for company in companies:
        assert pattern.match(company.licenseNumber), company.licenseNumber


def test_generate_properties_to_sanity_round_trip() -> None:
    properties = generate_properties(count=3, seed=1)
    for index, prop in enumerate(properties):
        payload = prop.to_sanity(doc_id=f"property-{index + 1:04d}")
        assert payload["_type"] == "property"
        assert payload["_id"] == f"property-{index + 1:04d}"
        assert payload["listedBy"]["_type"] == "reference"
        assert "_ref" in payload["listedBy"]
