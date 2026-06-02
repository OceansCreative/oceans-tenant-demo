"""SanityClient の HTTP ペイロード形状・リトライ・チャンク分割をモックで検証する。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest
import requests
from urllib3.util.retry import Retry

from oceans_tenant_seed.sanity_client import (
    CHUNK_SIZE,
    DEFAULT_BACKOFF_FACTOR,
    DEFAULT_MAX_RETRIES,
    DEFAULT_TIMEOUT,
    RETRY_ALLOWED_METHODS,
    RETRY_STATUS_FORCELIST,
    SanityClient,
    _build_retry,
    _build_session,
)


@dataclass
class _FakeResponse:
    status_code: int = 200
    _payload: dict[str, Any] = field(default_factory=lambda: {"transactionId": "tx-1"})
    text: str = ""
    headers: dict[str, str] = field(default_factory=dict)

    def json(self) -> dict[str, Any]:
        return self._payload


@dataclass
class _FakeSession:
    """同じ response を返すモックセッション。"""

    calls: list[dict[str, Any]] = field(default_factory=list)
    response: _FakeResponse = field(default_factory=_FakeResponse)

    def post(
        self,
        url: str,
        json: dict,
        headers: dict,
        timeout: tuple[int, int] | int,
    ) -> _FakeResponse:
        self.calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        return self.response


@dataclass
class _ScriptedSession:
    """事前に定義した response 列を順に返すモックセッション。

    urllib3 の Retry は通常 `HTTPAdapter` が透明に吸収するため、テストでは
    `Session.post` 自体が複数回呼ばれることを検証できない。よって本テストでは
    リトライ挙動を `_build_retry()` の設定値そのものでも検証する。
    """

    responses: list[_FakeResponse]
    calls: list[dict[str, Any]] = field(default_factory=list)

    def post(
        self,
        url: str,
        json: dict,
        headers: dict,
        timeout: tuple[int, int] | int,
    ) -> _FakeResponse:
        self.calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        if not self.responses:
            raise AssertionError("予期しない post 呼び出し")
        return self.responses.pop(0)


def _new_client(session: Any) -> SanityClient:
    return SanityClient(
        project_id="proj1",
        dataset="production",
        api_token="tok1",
        session=session,
    )


def test_create_or_replace_many_builds_mutation_payload() -> None:
    session = _FakeSession()
    client = _new_client(session)
    result = client.create_or_replace_many(
        [{"_id": "doc-1", "_type": "property", "title": "A"}]
    )
    assert result == {"transactionId": "tx-1"}
    assert len(session.calls) == 1
    call = session.calls[0]
    assert call["url"].endswith("/data/mutate/production")
    assert call["headers"]["Authorization"] == "Bearer tok1"
    assert call["json"] == {
        "mutations": [
            {"createOrReplace": {"_id": "doc-1", "_type": "property", "title": "A"}}
        ]
    }


def test_create_or_replace_many_requires_project_id() -> None:
    session = _FakeSession()
    client = SanityClient(project_id="", api_token="tok", session=session)
    with pytest.raises(RuntimeError, match="SANITY_PROJECT_ID"):
        client.create_or_replace_many([{"_id": "x"}])


def test_create_or_replace_many_requires_token() -> None:
    session = _FakeSession()
    client = SanityClient(project_id="p", api_token="", session=session)
    with pytest.raises(RuntimeError, match="SANITY_API_TOKEN"):
        client.create_or_replace_many([{"_id": "x"}])


def test_create_or_replace_many_raises_on_http_error() -> None:
    session = _FakeSession(
        response=_FakeResponse(status_code=400, text="bad request", _payload={})
    )
    client = _new_client(session)
    with pytest.raises(RuntimeError, match="400"):
        client.create_or_replace_many([{"_id": "x"}])


def test_create_or_replace_many_passes_timeout_tuple() -> None:
    """`(connect, read)` タプルが Session に渡ること。"""
    session = _FakeSession()
    client = _new_client(session)
    client.create_or_replace_many([{"_id": "x"}])
    assert session.calls[0]["timeout"] == DEFAULT_TIMEOUT
    assert DEFAULT_TIMEOUT == (10, 60)


def test_create_or_replace_many_accepts_custom_timeout() -> None:
    session = _FakeSession()
    client = SanityClient(
        project_id="p",
        api_token="t",
        session=session,
        timeout=(5, 30),
    )
    client.create_or_replace_many([{"_id": "x"}])
    assert session.calls[0]["timeout"] == (5, 30)


def test_create_or_replace_many_empty_input_returns_empty() -> None:
    """空入力時は HTTP を叩かず空 transaction を返す。"""
    session = _FakeSession()
    client = _new_client(session)
    result = client.create_or_replace_many([])
    assert session.calls == []
    assert result == {"transactionId": "", "results": []}


def test_create_or_replace_many_chunks_50_documents_per_request() -> None:
    """50 件以下は 1 リクエストに収まる。"""
    session = _FakeSession()
    client = _new_client(session)
    docs = [{"_id": f"doc-{i}"} for i in range(50)]
    client.create_or_replace_many(docs)
    assert len(session.calls) == 1
    assert len(session.calls[0]["json"]["mutations"]) == 50


def test_create_or_replace_many_chunks_120_documents_into_three_posts() -> None:
    """120 件入力 → 50 / 50 / 20 の 3 リクエスト。"""
    session = _FakeSession()
    client = _new_client(session)
    docs = [{"_id": f"doc-{i}"} for i in range(120)]
    client.create_or_replace_many(docs)
    assert len(session.calls) == 3
    assert len(session.calls[0]["json"]["mutations"]) == 50
    assert len(session.calls[1]["json"]["mutations"]) == 50
    assert len(session.calls[2]["json"]["mutations"]) == 20
    # 各 mutation は createOrReplace 形式
    first_mutation = session.calls[0]["json"]["mutations"][0]
    assert "createOrReplace" in first_mutation


def test_create_or_replace_many_respects_custom_chunk_size() -> None:
    session = _FakeSession()
    client = SanityClient(
        project_id="p",
        api_token="t",
        session=session,
        chunk_size=10,
    )
    docs = [{"_id": f"doc-{i}"} for i in range(25)]
    client.create_or_replace_many(docs)
    assert len(session.calls) == 3
    assert len(session.calls[0]["json"]["mutations"]) == 10
    assert len(session.calls[1]["json"]["mutations"]) == 10
    assert len(session.calls[2]["json"]["mutations"]) == 5


def test_create_or_replace_many_aborts_on_chunk_error() -> None:
    """途中チャンクが 400 を返した時点で例外送出（後続を投げない）。"""
    sess = _ScriptedSession(
        responses=[
            _FakeResponse(status_code=200, _payload={"transactionId": "tx-a"}),
            _FakeResponse(status_code=400, text="bad", _payload={}),
            _FakeResponse(status_code=200, _payload={"transactionId": "tx-c"}),
        ]
    )
    client = _new_client(sess)
    docs = [{"_id": f"doc-{i}"} for i in range(120)]
    with pytest.raises(RuntimeError, match="400"):
        client.create_or_replace_many(docs)
    # 2 チャンク目で停止する
    assert len(sess.calls) == 2


# ---------------------------------------------------------------------------
# リトライ戦略の構成値検証
#
# urllib3 の Retry は HTTPAdapter 内部で透過的に再送するため、`Session.post` が
# 何回呼ばれたか / `Retry-After` を尊重したか、を外側のモックから直接観測する手段は
# ない。よって本ファイルでは「Retry が想定設定で組まれていること」を構成値レベルで
# 検証する。実 HTTP を叩く統合テストはネットワーク禁止のためスコープ外。
# ---------------------------------------------------------------------------


def test_build_retry_configures_429_and_5xx_forcelist() -> None:
    retry = _build_retry()
    assert isinstance(retry, Retry)
    forcelist = set(retry.status_forcelist or [])
    assert {429, 500, 502, 503, 504}.issubset(forcelist)
    assert set(RETRY_STATUS_FORCELIST) == {429, 500, 502, 503, 504}


def test_build_retry_limits_method_to_post() -> None:
    retry = _build_retry()
    allowed = retry.allowed_methods or []
    assert "POST" in allowed
    # GET / DELETE などは対象外
    assert "GET" not in allowed
    assert "DELETE" not in allowed
    assert tuple(RETRY_ALLOWED_METHODS) == ("POST",)


def test_build_retry_total_and_backoff() -> None:
    retry = _build_retry()
    assert retry.total == DEFAULT_MAX_RETRIES == 5
    assert retry.backoff_factor == DEFAULT_BACKOFF_FACTOR
    # 429 の Retry-After ヘッダーを尊重する
    assert retry.respect_retry_after_header is True


def test_build_retry_get_backoff_time_grows_exponentially() -> None:
    """`backoff_factor` * 2 ** (retry - 1) で待機時間が伸びる挙動を確認する。"""
    retry = _build_retry()
    # 1 回目失敗→2 回目試行までの待機は 0、それ以降は exponential
    waits: list[float] = []
    current = retry
    # urllib3 Retry は increment() で履歴を積む
    for status in (503, 503, 503):
        current = current.increment(
            method="POST",
            url="https://example.invalid/",
            response=_RetryResponse(status),
        )
        waits.append(current.get_backoff_time())
    # 2 回目以降は単調増加（exponential backoff）
    assert waits[0] < waits[1] < waits[2]


@dataclass
class _RetryResponse:
    """urllib3 の Retry.increment() に渡すための最低限の HTTPResponse 互換。

    urllib3 v2 では `response.headers.get(...)` を直接参照するため dict を保持する。
    """

    status: int
    headers: dict[str, str] = field(default_factory=dict)

    @property
    def status_code(self) -> int:
        return self.status

    def get_redirect_location(self) -> bool:
        return False

    def getheader(self, name: str, default: Any = None) -> Any:  # noqa: D401
        return self.headers.get(name, default)

    def getheaders(self) -> dict[str, str]:
        return dict(self.headers)


def test_build_retry_fires_on_429_and_503() -> None:
    """429 / 503 が `is_retry()` で true となること（リトライ対象）。"""
    retry = _build_retry()
    # Retry.is_retry(method, status_code, has_retry_after) で対象判定
    assert retry.is_retry("POST", 429) is True
    assert retry.is_retry("POST", 503) is True
    assert retry.is_retry("POST", 500) is True
    assert retry.is_retry("POST", 502) is True
    assert retry.is_retry("POST", 504) is True
    # 200 系・400 はリトライしない
    assert retry.is_retry("POST", 200) is False
    assert retry.is_retry("POST", 400) is False
    assert retry.is_retry("POST", 404) is False


def test_build_retry_honors_retry_after_header() -> None:
    """429 で `Retry-After: <秒>` ヘッダーを尊重する。"""
    retry = _build_retry()
    resp = _RetryResponse(status=429, headers={"Retry-After": "7"})
    # get_retry_after は HTTPResponse 互換オブジェクトを受ける
    seconds = retry.get_retry_after(resp)
    assert seconds == 7.0


def test_build_retry_increments_on_429_and_eventually_exhausts() -> None:
    """429 を返し続けると最大 5 回までリトライして MaxRetryError 相当で打ち切られる。"""
    import urllib3.exceptions

    retry = _build_retry()
    current = retry
    increments = 0
    response = _RetryResponse(status=429)
    try:
        # 6 回繰り返せば total=5 を超えるため例外が出る想定
        for _ in range(10):
            current = current.increment(
                method="POST",
                url="https://example.invalid/",
                response=response,
            )
            increments += 1
    except urllib3.exceptions.MaxRetryError:
        pass
    # total=5 で打ち切られる
    assert increments == DEFAULT_MAX_RETRIES


def test_build_session_mounts_https_adapter_with_retry() -> None:
    """`_build_session()` が https / http 両方に Retry 付き Adapter をマウントする。"""
    session = _build_session()
    https_adapter = session.get_adapter("https://example.invalid/")
    http_adapter = session.get_adapter("http://example.invalid/")
    assert isinstance(https_adapter, requests.adapters.HTTPAdapter)
    assert isinstance(http_adapter, requests.adapters.HTTPAdapter)
    # HTTPAdapter は max_retries に Retry インスタンスを保持する
    assert isinstance(https_adapter.max_retries, Retry)
    assert https_adapter.max_retries.total == DEFAULT_MAX_RETRIES


def test_sanity_client_defaults_install_retry_session() -> None:
    """session 未指定で生成すると Retry 付き Session が組み込まれる。"""
    client = SanityClient(project_id="p", api_token="t")
    inner = client._session  # type: ignore[attr-defined]
    assert isinstance(inner, requests.Session)
    https_adapter = inner.get_adapter("https://example.invalid/")
    assert isinstance(https_adapter, requests.adapters.HTTPAdapter)
    assert isinstance(https_adapter.max_retries, Retry)


def test_chunk_size_constant_is_50() -> None:
    """ドキュメント記載・受け入れ条件に合致することを検証。"""
    assert CHUNK_SIZE == 50
