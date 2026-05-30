"""Sanity スキーマ（packages/shared 側）と対応する Pydantic モデル。

TypeScript 側の Zod スキーマと 1:1 で対応させ、ダミーデータ生成時の
バリデーションを Python レイヤでも強制する。
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Availability = Literal["public", "negotiating", "closed"]
BuildingType = Literal[
    "street_level",
    "building_inline",
    "second_floor_or_above",
    "basement",
    "stand_alone",
    "other",
]
Condition = Literal["skeleton", "second_hand", "transferable_fixtures"]

# 47 都道府県（packages/shared/src/property/address.ts と同期）
PREFECTURES: tuple[str, ...] = (
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
    "岐阜県", "静岡県", "愛知県", "三重県",
    "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
    "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県",
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県",
    "沖縄県",
)


class Geopoint(BaseModel):
    """緯度経度。日本国内範囲（lat 20〜46, lng 122〜154）。"""

    model_config = ConfigDict(extra="forbid")

    lat: float = Field(ge=20.0, le=46.0)
    lng: float = Field(ge=122.0, le=154.0)


class Address(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prefecture: str
    city: str = Field(min_length=1, max_length=80)
    streetAddress: str | None = Field(default=None, max_length=120)
    buildingName: str | None = Field(default=None, max_length=120)
    roomNumber: str | None = Field(default=None, max_length=40)
    geopoint: Geopoint

    @field_validator("prefecture")
    @classmethod
    def _check_prefecture(cls, value: str) -> str:
        if value not in PREFECTURES:
            raise ValueError(f"不正な都道府県: {value}")
        return value


class NearestStation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    line: str = Field(min_length=1, max_length=60)
    station: str = Field(min_length=1, max_length=40)
    walkMinutes: int = Field(ge=0, le=60)


class PropertyDraft(BaseModel):
    """Sanity に POST する property ドキュメントのドラフト形式。

    `_type: "property"` を含める必要があるため to_sanity() で整形する。
    """

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=96, pattern=r"^[a-z0-9-]+$")
    address: Address
    nearestStations: list[NearestStation] = Field(default_factory=list, max_length=5)
    rent: int = Field(ge=0)
    commonFee: int | None = Field(default=None, ge=0)
    depositMonths: float | None = Field(default=None, ge=0, le=24)
    keyMoneyMonths: float | None = Field(default=None, ge=0, le=24)
    area: float = Field(gt=0, le=10000)
    floor: str | None = Field(default=None, max_length=40)
    buildingType: BuildingType | None = None
    condition: Condition | None = None
    previousBusiness: str | None = Field(default=None, max_length=120)
    suitableBusinessRefs: list[str] = Field(default_factory=list, max_length=20)
    description: str | None = Field(default=None, max_length=4000)
    features: list[str] = Field(default_factory=list, max_length=20)
    availability: Availability
    listedByRef: str = Field(min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")
    sourceUrl: str | None = None
    aiExtracted: bool = False
    aiConfidence: float | None = Field(default=None, ge=0.0, le=1.0)
    publishedAt: str

    def to_sanity(self, doc_id: str | None = None) -> dict:
        """Sanity の mutate API（`createOrReplace`）に渡せる dict を返す。"""
        payload = self.model_dump(exclude_none=True)
        payload["_type"] = "property"
        if doc_id:
            payload["_id"] = doc_id
        # listedBy は reference オブジェクトに変換
        payload["listedBy"] = {
            "_type": "reference",
            "_ref": payload.pop("listedByRef"),
        }
        # suitableBusinessRefs は reference 配列に変換
        if "suitableBusinessRefs" in payload:
            payload["suitableBusinesses"] = [
                {"_type": "reference", "_ref": ref}
                for ref in payload.pop("suitableBusinessRefs")
            ]
        # slug は object 形式に
        payload["slug"] = {"_type": "slug", "current": payload["slug"]}
        return payload


class RealEstateCompanyDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=96, pattern=r"^[a-z0-9-]+$")
    description: str | None = Field(default=None, max_length=2000)
    contactEmail: EmailStr
    contactPhone: str | None = None
    licenseNumber: str = Field(min_length=1, max_length=60)
    representativeName: str = Field(min_length=1, max_length=60)
    websiteUrl: str | None = None

    def to_sanity(self, doc_id: str | None = None) -> dict:
        payload = self.model_dump(exclude_none=True)
        payload["_type"] = "realEstateCompany"
        if doc_id:
            payload["_id"] = doc_id
        payload["slug"] = {"_type": "slug", "current": payload["slug"]}
        return payload
