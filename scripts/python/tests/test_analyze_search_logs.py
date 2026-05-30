"""analyze_search_logs の集計関数テスト。

matplotlib 依存はテストでは触らず、集計ロジックのみを検証する。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

import analyze_search_logs as module


def _make_session(
    prefectures: list[str] | None = None,
    business_refs: list[str] | None = None,
    message_count: int = 0,
) -> dict[str, Any]:
    return {
        "sessionId": "abc",
        "messages": [{"role": "user", "content": "x"}] * message_count,
        "extractedCriteria": {
            "prefectures": prefectures or [],
            "businessCategoryRefs": business_refs or [],
        },
        "createdAt": "2026-05-01T00:00:00Z",
    }


def test_count_prefectures_aggregates_correctly() -> None:
    sessions = [
        _make_session(prefectures=["東京都"]),
        _make_session(prefectures=["東京都", "大阪府"]),
        _make_session(prefectures=["福岡県"]),
    ]
    counter = module.count_prefectures(sessions)
    assert counter["東京都"] == 2
    assert counter["大阪府"] == 1
    assert counter["福岡県"] == 1


def test_count_prefectures_ignores_missing_keys() -> None:
    sessions = [
        {"sessionId": "x", "extractedCriteria": None, "messages": []},
        {"sessionId": "y"},
    ]
    counter = module.count_prefectures(sessions)
    assert counter == {}


def test_count_business_refs() -> None:
    sessions = [
        _make_session(business_refs=["category-cafe"]),
        _make_session(business_refs=["category-cafe", "category-bar"]),
    ]
    counter = module.count_business_refs(sessions)
    assert counter["category-cafe"] == 2
    assert counter["category-bar"] == 1


def test_count_message_lengths() -> None:
    sessions = [
        _make_session(message_count=3),
        _make_session(message_count=0),
        _make_session(message_count=7),
    ]
    assert module.count_message_lengths(sessions) == [3, 0, 7]


def test_load_sessions_from_file_rejects_non_array(tmp_path: Path) -> None:
    path = tmp_path / "x.json"
    path.write_text("{}", encoding="utf-8")
    with pytest.raises(RuntimeError):
        module.load_sessions_from_file(path)


def test_load_sessions_from_file_reads_array(tmp_path: Path) -> None:
    path = tmp_path / "x.json"
    path.write_text(
        json.dumps([_make_session(prefectures=["東京都"])]), encoding="utf-8"
    )
    sessions = module.load_sessions_from_file(path)
    assert len(sessions) == 1


def test_analyze_writes_summary(tmp_path: Path) -> None:
    sessions = [
        _make_session(prefectures=["東京都"], business_refs=["category-cafe"], message_count=4),
        _make_session(prefectures=["東京都"], business_refs=["category-bar"], message_count=2),
    ]
    summary = module.analyze(sessions, tmp_path)
    assert summary["totalSessions"] == 2
    assert summary["averageMessages"] == 3
    assert ("東京都", 2) in summary["topPrefectures"]
    assert (tmp_path / "summary.json").exists()
