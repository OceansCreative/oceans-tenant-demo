"""Sanity HTTP API クライアント。

`SANITY_PROJECT_ID` / `SANITY_DATASET` / `SANITY_API_TOKEN` から構成する。

運用堅牢性のため以下を備える:
  * `urllib3.util.retry.Retry` を `HTTPAdapter` 経由でセッションへマウントし、
    429 / 5xx に対する exponential backoff リトライ（`Retry-After` 尊重）
  * `(connect, read)` の二段タイムアウト
  * 1 リクエストあたり mutations を `CHUNK_SIZE` 件に分割

設計判断 (atomic vs chunk):
  Sanity の単一 mutation request はトランザクション内で atomic に適用されるが、
  ペイロードが大きくなると 413 / タイムアウトを誘発する。本クライアントはシード用途で
  あり、`createOrReplace` は冪等なため再実行で収束する。よってチャンク間の atomic 性は
  保証しない（チャンクごとに別トランザクション）方針を採用する。完全 atomic が必要な
  ケースでは利用箇所側で `CHUNK_SIZE` 以下に抑えること。
"""
from __future__ import annotations

import os
from typing import Iterable, Protocol

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

#: 1 リクエストあたりに投げる mutation 件数の上限。
CHUNK_SIZE = 50

#: `(connect, read)` 秒単位タイムアウト。
DEFAULT_TIMEOUT: tuple[int, int] = (10, 60)

#: リトライ最大回数（最初の試行を除く）。
DEFAULT_MAX_RETRIES = 5

#: リトライ対象 HTTP ステータス。
RETRY_STATUS_FORCELIST: tuple[int, ...] = (429, 500, 502, 503, 504)

#: リトライ対象 HTTP メソッド（Sanity mutation は POST）。
RETRY_ALLOWED_METHODS: tuple[str, ...] = ("POST",)

#: exponential backoff の係数。`{backoff_factor} * (2 ** ({retry} - 1))` 秒待機。
DEFAULT_BACKOFF_FACTOR = 0.5


class _Session(Protocol):
    def post(
        self,
        url: str,
        json: dict,
        headers: dict,
        timeout: tuple[int, int] | int,
    ) -> requests.Response: ...


def _build_retry() -> Retry:
    """Sanity 向け Retry 設定を生成する。

    * `total` で全リトライ回数を制限
    * `status_forcelist` で 429 / 5xx を捕捉
    * `allowed_methods` を POST に絞り、createOrReplace に限定
    * `backoff_factor` で exponential backoff
    * `respect_retry_after_header=True` で 429 の `Retry-After` を尊重
    """
    return Retry(
        total=DEFAULT_MAX_RETRIES,
        status=DEFAULT_MAX_RETRIES,
        connect=DEFAULT_MAX_RETRIES,
        read=DEFAULT_MAX_RETRIES,
        status_forcelist=list(RETRY_STATUS_FORCELIST),
        allowed_methods=list(RETRY_ALLOWED_METHODS),
        backoff_factor=DEFAULT_BACKOFF_FACTOR,
        respect_retry_after_header=True,
        raise_on_status=False,
    )


def _build_session() -> requests.Session:
    """リトライ戦略をマウントした `requests.Session` を返す。"""
    session = requests.Session()
    adapter = HTTPAdapter(max_retries=_build_retry())
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


class SanityClient:
    """`createOrReplace` mutation を投げるクライアント。

    リトライ・バックオフ・チャンク分割を内包し、シードスクリプトの運用堅牢性を担う。
    """

    def __init__(
        self,
        project_id: str | None = None,
        dataset: str | None = None,
        api_token: str | None = None,
        api_version: str = "2024-10-01",
        session: _Session | None = None,
        chunk_size: int = CHUNK_SIZE,
        timeout: tuple[int, int] = DEFAULT_TIMEOUT,
    ) -> None:
        self.project_id = project_id or os.environ.get("SANITY_PROJECT_ID", "")
        self.dataset = dataset or os.environ.get("SANITY_DATASET", "production")
        self.api_token = api_token or os.environ.get("SANITY_API_TOKEN", "")
        self.api_version = api_version
        self.chunk_size = chunk_size
        self.timeout = timeout
        self._session: _Session = session or _build_session()  # type: ignore[assignment]

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
        """全 documents を `chunk_size` 件ずつ分割して POST する。

        戻り値は最終チャンクの response JSON。チャンクごとに別トランザクションとなる点に
        注意（モジュール冒頭の docstring 参照）。
        """
        if not self.project_id:
            raise RuntimeError("SANITY_PROJECT_ID が未設定です")
        if not self.api_token:
            raise RuntimeError("SANITY_API_TOKEN が未設定です")

        docs = list(documents)
        if not docs:
            return {"transactionId": "", "results": []}

        last_response: dict = {}
        for start in range(0, len(docs), self.chunk_size):
            chunk = docs[start : start + self.chunk_size]
            mutations = [{"createOrReplace": doc} for doc in chunk]
            response = self._session.post(
                self.mutations_url,
                json={"mutations": mutations},
                headers={
                    "Authorization": f"Bearer {self.api_token}",
                    "Content-Type": "application/json",
                },
                timeout=self.timeout,
            )
            if response.status_code >= 400:
                raise RuntimeError(
                    f"Sanity mutation failed: {response.status_code} {response.text}"
                )
            last_response = response.json()
        return last_response
