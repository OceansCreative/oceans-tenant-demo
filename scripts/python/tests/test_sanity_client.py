"""SanityClient の HTTP ペイロード形状をモックセッションで検証する。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from oceans_tenant_seed.sanity_client import SanityClient


@dataclass
class _FakeResponse:
    status_code: int = 200
    _payload: dict[str, Any] = field(default_factory=lambda: {"transactionId": "tx-1"})
    text: str = ""

    def json(self) -> dict[str, Any]:
        return self._payload


@dataclass
class _FakeSession:
    calls: list[dict[str, Any]] = field(default_factory=list)
    response: _FakeResponse = field(default_factory=_FakeResponse)

    def post(self, url: str, json: dict, headers: dict, timeout: int) -> _FakeResponse:
        self.calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        return self.response


def _new_client(session: _FakeSession) -> SanityClient:
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
