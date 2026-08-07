#!/usr/bin/env python3
"""T2 — Parse: flatten the recursive FIP "value tree" into clean claim records.

The FIP backend returns a generic recursive structure. Every node carries a
`valueIdentifier` that tells us WHAT a field is. Repeatable fields appear as
multiple sibling nodes with the same `valueIdentifier`.

Key fields extracted per policy item:
  policyItemCode      stable claim ID (e.g. POL-HC-11221)
  hcClaim             the claim text (often HTML)
  hcHealthRelationship   e.g. "maintenance of normal bone"
  hcClaimStatus       AUTHORISED / NON_AUTHORISED / REVOKED
  hcClaimType         Art 13(1) / 13(5) / 14(1)(a) / 14(1)(b)
  hcCondOfUse         conditions of use (if any)
  hcEntryId           one or more food/substance entries the claim targets
  hcEfsaQuestionNbr   EFSA opinion reference (scientific evidence)
  hcEfsaQuestionUrl   link to the EFSA scientific opinion
  hcLegislation       authorising legal act
  hcReasonsForNonAuth reason codes when not authorised
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

STATUS_MAP = {
    "HCCS_AUTHORISED": "authorised",
    "HCCS_NON_AUTHORISED": "non_authorised",
    "HCCS_REVOKED": "revoked",
}

TYPE_MAP = {
    "HCLBT_13_1": "Art. 13(1)",
    "HCLBT_13_5": "Art. 13(5)",
    "HCLBT_14_1_A": "Art. 14(1)(a)",
    "HCLBT_14_1_B": "Art. 14(1)(b)",
}

_RE_TAG = re.compile(r"<[^>]+>")


def walk(node: dict):
    """Depth-first traversal of the value tree."""
    yield node
    for child in node.get("childrenValues") or []:
        yield from walk(child)


def all_values(item: dict, ident: str) -> list[str]:
    return [
        n["value"]
        for n in walk(item)
        if n.get("valueIdentifier") == ident and n.get("value") is not None
    ]


def first_value(item: dict, ident: str) -> str | None:
    vals = all_values(item, ident)
    return vals[0] if vals else None


def strip_html(raw: str | None) -> str | None:
    if not raw:
        return None
    text = _RE_TAG.sub(" ", html.unescape(raw))
    return re.sub(r"\s+", " ", text).strip()


def efsa_references(item: dict) -> list[dict]:
    """EFSA opinions are nested: hcEfsaOpinionReferenceWrapper > Map > {Nbr, Url}."""
    refs = []
    for map_node in all_nodes(item, "hcEfsaOpinionReferenceMap"):
        nbr = next(
            (n["value"] for n in walk(map_node) if n.get("valueIdentifier") == "hcEfsaQuestionNbr"),
            None,
        )
        url = next(
            (n["value"] for n in walk(map_node) if n.get("valueIdentifier") == "hcEfsaQuestionUrl"),
            None,
        )
        if nbr or url:
            refs.append({"reference": nbr, "url": url})
    return refs


def legislations(item: dict) -> list[dict]:
    legs = []
    for leg in all_nodes(item, "hcLegislationsComplex"):
        legs.append(
            {
                "act": first_value(leg, "hcLegalActPubType"),
                "legislation": first_value(leg, "hcLegislation"),
                "eurlex_url": first_value(leg, "hcEurLexUrl"),
            }
        )
    return legs


def all_nodes(item: dict, ident: str) -> list[dict]:
    return [n for n in walk(item) if n.get("valueIdentifier") == ident]


def parse_item(item: dict) -> dict:
    return {
        "policy_item_code": first_value(item, "policyItemCode"),
        "status": STATUS_MAP.get(first_value(item, "hcClaimStatus"), first_value(item, "hcClaimStatus")),
        "claim_type": TYPE_MAP.get(first_value(item, "hcClaimType"), first_value(item, "hcClaimType")),
        "claim_text": strip_html(first_value(item, "hcClaim")),
        "health_relationship": first_value(item, "hcHealthRelationship"),
        "conditions_of_use": strip_html(first_value(item, "hcCondOfUse")),
        "restriction_of_use": strip_html(first_value(item, "hcRestrictionOfUse")),
        "substances_or_entries": all_values(item, "hcEntryId"),
        "nutrient_or_food_cat": strip_html(first_value(item, "hcNutSubFoodCat")),
        "efsa_references": efsa_references(item),
        "legislation": legislations(item),
        "reasons_for_non_auth": all_values(item, "hcReasonsForNonAuth"),
        "data_protection": first_value(item, "hcProtectDataGrantedForClaim"),
        "applicant_country": first_value(item, "hcApplicantCountry"),
        "applicant_company": first_value(item, "hcApplicantCompanyName"),
    }


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    raw_path = repo_root / "data/raw/policy_items.json"
    out_path = repo_root / "data/parsed/claims.jsonl"

    if not raw_path.exists():
        raise SystemExit(f"Raw data not found at {raw_path}. Run fetch_eu_register.py first.")

    print(f"[parse] loading {raw_path} ...")
    with raw_path.open("r", encoding="utf-8") as fh:
        items = json.load(fh)

    print(f"[parse] {len(items)} raw policy items -> flattening ...")
    records = [parse_item(item) for item in items]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    counts = {}
    for rec in records:
        counts[rec["status"]] = counts.get(rec["status"], 0) + 1
    print(f"[parse] wrote {len(records)} records -> {out_path}")
    print(f"[parse] status breakdown: {counts}")

    sample = next((r for r in records if r["status"] == "authorised"), records[0])
    print(f"[parse] sample authorised claim:")
    print(f"    {sample['claim_text'][:160]}...")
    print(f"    relationship: {sample['health_relationship']}")
    print(f"    conditions:   {(sample['conditions_of_use'] or '')[:120]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
