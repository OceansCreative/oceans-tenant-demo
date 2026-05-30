"""Sanity HTTP API クライアント（最小実装）。

`SANITY_PROJECT_ID` / `SANITY_DATASET` / `SANITY_API_TOKEN` から構成する。
"""
from __future__ import annotations

import os
from typing import Iterable, Protocol

import requests


class _Session(Protocol):
    def post(self, url: str, json: dict, headers: dict, timeout: int) -> requests.Response: ...


class SanityClient:
    """`createOrReplace` mutation を投げるだけのシンプルなクライアント。"""

    def __init__(
        self,
        project_id: str | None = None,
        dataset: str | None = None,
        api_token: str | None = None,
        api_version: str = "2024-10-01",
        session: _Session | None = None,
    ) -> None:
        self.project_id = project_id or os.environ.get("SANITY_PROJECT_ID", "")
        self.dataset = dataset or os.environ.get("SANITY_DATASET", "production")
        self.api_token = api_token or os.environ.get("SANITY_API_TOKEN", "")
        self.api_version = api_version
        self._session: _Session = session or requests.Session()  # type: ignore[assignment]

    @property
    def mutations_url(self) -> str:
        return (
            f"https://{self.project_id}.api.sanity.io"
            f"/v{self.api_version}/data/mutate/{self.dataset}"
        )

    def create_or_replace_many(
        self,
        documents: Iterable[dict],
    ) -> dict:
        if not self.project_id:
            raise RuntimeError("SANITY_PROJECT_ID が未設定です")
        if not self.api_token:
            raise RuntimeError("SANITY_API_TOKEN が未設定です")
        mutations = [{"createOrReplace": doc} for doc in documents]
        response = self._session.post(
            self.mutations_url,
            json={"mutations": mutations},
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"Sanity mutation failed: {response.status_code} {response.text}"
            )
        return response.json()
