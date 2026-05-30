"""ダミー物件 50 件を Sanity にシードする CLI スクリプト。

使い方:
  python -m scripts.python.seed_properties --count 50 --dry-run
  python -m scripts.python.seed_properties --count 50

環境変数:
  SANITY_PROJECT_ID
  SANITY_DATASET (default: production)
  SANITY_API_TOKEN (write 権限)
"""
from __future__ import annotations

import argparse
import json
import sys

from dotenv import load_dotenv

from oceans_tenant_seed import (
    generate_properties,
    generate_real_estate_companies,
)
from oceans_tenant_seed.sanity_client import SanityClient


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--count",
        type=int,
        default=50,
        help="生成する物件数（既定: 50）",
    )
    parser.add_argument(
        "--company-count",
        type=int,
        default=5,
        help="生成する不動産会社数（既定: 5）",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=20260530,
        help="乱数シード（決定論性のために固定推奨）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Sanity へ送信せず標準出力に JSON を流す",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    parser = _build_arg_parser()
    args = parser.parse_args(argv)

    companies = generate_real_estate_companies(
        count=args.company_count, seed=args.seed
    )
    properties = generate_properties(
        count=args.count, seed=args.seed, company_count=args.company_count
    )

    company_docs = [c.to_sanity(doc_id=f"company-{i + 1:03d}") for i, c in enumerate(companies)]
    property_docs = [p.to_sanity(doc_id=f"property-{i + 1:04d}") for i, p in enumerate(properties)]
    all_docs = company_docs + property_docs

    if args.dry_run:
        json.dump(all_docs, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        print(
            f"\ndry-run: companies={len(company_docs)} properties={len(property_docs)}",
            file=sys.stderr,
        )
        return 0

    client = SanityClient()
    response = client.create_or_replace_many(all_docs)
    print(
        f"投入完了: companies={len(company_docs)} properties={len(property_docs)} "
        f"transactionId={response.get('transactionId', '')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
