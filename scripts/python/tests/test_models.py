"""Pydantic モデルの境界・正常系テスト。"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from oceans_tenant_seed.models import (
    Address,
    Geopoint,
    NearestStation,
    PropertyDraft,
    RealEstateCompanyDraft,
)


# ---------- Geopoint ----------

def test_geopoint_accepts_japan_range() -> None:
    point = Geopoint(lat=35.689, lng=139.692)
    assert point.lat == 35.689


@pytest.mark.parametrize("lat", [19.999, 46.001, -1])
def test_geopoint_rejects_out_of_japan_latitude(lat: float) -> None:
    with pytest.raises(ValidationError):
        Geopoint(lat=lat, lng=140)


@pytest.mark.parametrize("lng", [121.999, 154.001])
def test_geopoint_rejects_out_of_japan_longitude(lng: float) -> None:
    with pytest.raises(ValidationError):
        Geopoint(lat=35, lng=lng)


def test_geopoint_forbids_extra_keys() -> None:
    with pytest.raises(ValidationError):
        Geopoint(lat=35, lng=140, alt=100)  # type: ignore[call-arg]


# ---------- Address ----------

def _valid_address(**overrides: object) -> Address:
    data: dict = {
        "prefecture": "東京都",
        "city": "新宿区",
        "geopoint": {"lat": 35.689, "lng": 139.692},
    }
    data.update(overrides)
    return Address(**data)  # type: ignore[arg-type]


def test_address_valid() -> None:
    address = _valid_address()
    assert address.prefecture == "東京都"


def test_address_rejects_unknown_prefecture() -> None:
    with pytest.raises(ValidationError):
        _valid_address(prefecture="江戸府")


def test_address_rejects_empty_city() -> None:
    with pytest.raises(ValidationError):
        _valid_address(city="")


def test_address_forbids_extra_keys() -> None:
    with pytest.raises(ValidationError):
        _valid_address(unknown="x")


# ---------- NearestStation ----------

def test_nearest_station_walk_minutes_must_be_integer_zero_to_sixty() -> None:
    NearestStation(line="JR 山手線", station="新宿", walkMinutes=5)
    with pytest.raises(ValidationError):
        NearestStation(line="x", station="y", walkMinutes=61)
    with pytest.raises(ValidationError):
        NearestStation(line="x", station="y", walkMinutes=-1)


# ---------- PropertyDraft ----------

def _valid_property(**overrides: object) -> PropertyDraft:
    data: dict = {
        "title": "サンプル物件",
        "slug": "sample-property",
        "address": {
            "prefecture": "東京都",
            "city": "新宿区",
            "geopoint": {"lat": 35.689, "lng": 139.692},
        },
        "rent": 480000,
        "area": 33.0,
        "availability": "public",
        "listedByRef": "company-001",
        "publishedAt": "2026-05-01T00:00:00Z",
    }
    data.update(overrides)
    return PropertyDraft(**data)  # type: ignore[arg-type]


def test_property_minimal() -> None:
    prop = _valid_property()
    assert prop.rent == 480000
    assert prop.aiExtracted is False


def test_property_slug_must_be_lowercase() -> None:
    with pytest.raises(ValidationError):
        _valid_property(slug="Sample")


def test_property_rent_must_be_non_negative() -> None:
    with pytest.raises(ValidationError):
        _valid_property(rent=-1)


def test_property_area_must_be_positive() -> None:
    with pytest.raises(ValidationError):
        _valid_property(area=0)


def test_property_area_max_10000() -> None:
    with pytest.raises(ValidationError):
        _valid_property(area=10001)


def test_property_ai_confidence_must_be_within_zero_one() -> None:
    with pytest.raises(ValidationError):
        _valid_property(aiExtracted=True, aiConfidence=1.1)


def test_property_to_sanity_includes_reference() -> None:
    prop = _valid_property()
    payload = prop.to_sanity(doc_id="property-0001")
    assert payload["_id"] == "property-0001"
    assert payload["_type"] == "property"
    assert payload["listedBy"] == {"_type": "reference", "_ref": "company-001"}
    assert payload["slug"] == {"_type": "slug", "current": "sample-property"}


def test_property_to_sanity_converts_business_refs() -> None:
    prop = _valid_property(suitableBusinessRefs=["category-cafe", "category-retail"])
    payload = prop.to_sanity()
    assert payload["suitableBusinesses"] == [
        {"_type": "reference", "_ref": "category-cafe"},
        {"_type": "reference", "_ref": "category-retail"},
    ]


# ---------- RealEstateCompanyDraft ----------

def _valid_company(**overrides: object) -> RealEstateCompanyDraft:
    data: dict = {
        "name": "サンプル不動産株式会社",
        "slug": "sample-realty",
        "contactEmail": "info@example.com",
        "licenseNumber": "東京都知事(3)第12345号",
        "representativeName": "佐藤 太郎",
    }
    data.update(overrides)
    return RealEstateCompanyDraft(**data)  # type: ignore[arg-type]


def test_company_minimal() -> None:
    c = _valid_company()
    assert c.name.endswith("株式会社")


def test_company_invalid_email() -> None:
    with pytest.raises(ValidationError):
        _valid_company(contactEmail="not-an-email")


def test_company_to_sanity_slug_object() -> None:
    c = _valid_company()
    payload = c.to_sanity(doc_id="company-001")
    assert payload["slug"] == {"_type": "slug", "current": "sample-realty"}
    assert payload["_type"] == "realEstateCompany"
