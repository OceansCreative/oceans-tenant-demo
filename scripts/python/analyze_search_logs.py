"""Sanity の searchSession ドキュメントを分析し、PNG レポートを出力する CLI。

使い方:
  python analyze_search_logs.py --input sessions.json --output-dir reports/
  python analyze_search_logs.py --fetch                # Sanity API から直接取得

入力 JSON フォーマット（list[dict] で _type=searchSession のドキュメント）:
  [
    {
      "sessionId": "...",
      "messages": [...],
      "extractedCriteria": {...},
      "createdAt": "2026-..."
    },
    ...
  ]

環境変数（--fetch 時のみ必須）:
  SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_TOKEN
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

import requests


PREFECTURE_KEY = "prefectures"
BUSINESS_REFS_KEY = "businessCategoryRefs"


def fetch_sessions_from_sanity(limit: int = 200) -> list[dict[str, Any]]:
    project_id = os.environ.get("SANITY_PROJECT_ID")
    dataset = os.environ.get("SANITY_DATASET", "production")
    token = os.environ.get("SANITY_API_TOKEN")
    if not project_id or not token:
        raise RuntimeError(
            "SANITY_PROJECT_ID / SANITY_API_TOKEN を設定してください"
        )
    query = f'*[_type=="searchSession"] | order(createdAt desc) [0...{limit}]'
    url = (
        f"https://{project_id}.api.sanity.io/v2024-10-01/data/query/{dataset}"
        f"?query={requests.utils.quote(query)}"
    )
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    sessions = payload.get("result", [])
    if not isinstance(sessions, list):
        raise RuntimeError("Sanity 応答が想定外の形式です")
    return sessions


def load_sessions_from_file(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as fp:
        data = json.load(fp)
    if not isinstance(data, list):
        raise RuntimeError("入力 JSON は配列である必要があります")
    return data


def count_prefectures(sessions: Iterable[dict[str, Any]]) -> Counter:
    counter: Counter[str] = Counter()
    for session in sessions:
        criteria = session.get("extractedCriteria") or {}
        prefectures = criteria.get(PREFECTURE_KEY) or []
        if isinstance(prefectures, list):
            for prefecture in prefectures:
                if isinstance(prefecture, str):
                    counter[prefecture] += 1
    return counter


def count_business_refs(sessions: Iterable[dict[str, Any]]) -> Counter:
    counter: Counter[str] = Counter()
    for session in sessions:
        criteria = session.get("extractedCriteria") or {}
        refs = criteria.get(BUSINESS_REFS_KEY) or []
        if isinstance(refs, list):
            for ref in refs:
                if isinstance(ref, str):
                    counter[ref] += 1
    return counter


def count_message_lengths(sessions: Iterable[dict[str, Any]]) -> list[int]:
    lengths: list[int] = []
    for session in sessions:
        messages = session.get("messages") or []
        if isinstance(messages, list):
            lengths.append(len(messages))
    return lengths


def render_bar_png(counter: Counter, title: str, output_path: Path, top_n: int = 10) -> None:
    """matplotlib は遅延 import（テストで重い依存を避ける）。"""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    items = counter.most_common(top_n)
    if not items:
        return
    labels = [item[0] for item in items]
    values = [item[1] for item in items]

    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.barh(range(len(items)), values, color="#2563eb")
    ax.set_yticks(range(len(items)))
    ax.set_yticklabels(labels)
    ax.invert_yaxis()
    ax.set_xlabel("件数")
    ax.set_title(title)
    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def render_histogram_png(values: list[int], title: str, output_path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if not values:
        return
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.hist(values, bins=range(0, max(values) + 2), color="#16a34a")
    ax.set_xlabel("メッセージ数")
    ax.set_ylabel("セッション数")
    ax.set_title(title)
    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def analyze(sessions: list[dict[str, Any]], output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    prefectures = count_prefectures(sessions)
    business_refs = count_business_refs(sessions)
    message_lengths = count_message_lengths(sessions)
    render_bar_png(prefectures, "都道府県別 検索数（Top 10）", output_dir / "prefectures.png")
    render_bar_png(business_refs, "業種別 検索数（Top 10）", output_dir / "business_refs.png")
    render_histogram_png(message_lengths, "セッション毎のメッセージ数分布", output_dir / "message_lengths.png")
    summary = {
        "totalSessions": len(sessions),
        "topPrefectures": prefectures.most_common(10),
        "topBusinessRefs": business_refs.most_common(10),
        "averageMessages": (
            sum(message_lengths) / len(message_lengths) if message_lengths else 0
        ),
    }
    with (output_dir / "summary.json").open("w", encoding="utf-8") as fp:
        json.dump(summary, fp, ensure_ascii=False, indent=2)
    return summary


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--input", type=Path, help="入力 JSON ファイル")
    src.add_argument("--fetch", action="store_true", help="Sanity API から直接取得")
    parser.add_argument(
        "--output-dir", type=Path, default=Path("reports"), help="出力先ディレクトリ"
    )
    parser.add_argument(
        "--limit", type=int, default=200, help="Sanity から取得するセッション数"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_arg_parser()
    args = parser.parse_args(argv)
    if args.fetch:
        sessions = fetch_sessions_from_sanity(args.limit)
    else:
        sessions = load_sessions_from_file(args.input)
    summary = analyze(sessions, args.output_dir)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
