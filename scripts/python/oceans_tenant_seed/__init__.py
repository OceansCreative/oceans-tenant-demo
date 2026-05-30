"""OceansTenant Sanity 向けダミーデータ生成パッケージ。

公開 OSS リファレンス実装のため、実在企業名・実在物件情報は一切含まない。
"""
from .models import Address, NearestStation, PropertyDraft, RealEstateCompanyDraft
from .generator import (
    AREA_CENTERS,
    generate_properties,
    generate_real_estate_companies,
)

__all__ = [
    "AREA_CENTERS",
    "Address",
    "NearestStation",
    "PropertyDraft",
    "RealEstateCompanyDraft",
    "generate_properties",
    "generate_real_estate_companies",
]
