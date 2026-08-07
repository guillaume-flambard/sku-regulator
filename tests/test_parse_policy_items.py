"""Unit tests for the FIP value-tree parser (no infrastructure required)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ingest.parse_policy_items import (  # noqa: E402
    STATUS_MAP,
    all_nodes,
    all_values,
    efsa_references,
    first_value,
    legislations,
    parse_item,
    strip_html,
    walk,
)


def make_node(value_identifier, value, children=None):
    return {
        "value": value,
        "childrenValues": children or [],
        "valueIdentifier": value_identifier,
        "id": 1,
        "lastModificationDate": "2024-01-01T00:00:00",
        "valueDefinitionId": 1,
        "ordinal": None,
        "parentValueId": None,
        "collectionId": None,
    }


# --- walk ----------------------------------------------------------------

def test_walk_yields_root_and_children_depth_first():
    leaf_a = make_node("fieldA", "a")
    leaf_b = make_node("fieldB", "b")
    root = make_node("root", None, [leaf_a, leaf_b])
    idents = [n["valueIdentifier"] for n in walk(root)]
    assert idents == ["root", "fieldA", "fieldB"]


def test_walk_handles_empty_children():
    root = make_node("root", None, [])
    assert [n["valueIdentifier"] for n in walk(root)] == ["root"]


# --- all_values / first_value -------------------------------------------

def test_all_values_collects_repeated_identifiers():
    item = make_node("root", None, [
        make_node("hcEntryId", "224"),
        make_node("hcEntryId", "230"),
        make_node("hcOther", "x"),
    ])
    assert all_values(item, "hcEntryId") == ["224", "230"]


def test_all_values_ignores_none_values():
    item = make_node("root", None, [
        make_node("hcEntryId", None),
        make_node("hcEntryId", "9"),
    ])
    assert all_values(item, "hcEntryId") == ["9"]


def test_first_value_returns_first_or_none():
    item = make_node("root", None, [make_node("code", "A"), make_node("code", "B")])
    assert first_value(item, "code") == "A"
    assert first_value(item, "missing") is None


def test_all_nodes_returns_node_dicts_not_values():
    item = make_node("root", None, [make_node("leg", "L1"), make_node("leg", "L2")])
    nodes = all_nodes(item, "leg")
    assert len(nodes) == 2
    assert all(n["valueIdentifier"] == "leg" for n in nodes)


# --- strip_html ----------------------------------------------------------

def test_strip_html_removes_tags_and_collapses_space():
    assert strip_html("<p>Hello <b>world</b></p>") == "Hello world"


def test_strip_html_unescapes_entities():
    assert strip_html("Vitamin C &amp; D &lt;3") == "Vitamin C & D <3"


def test_strip_html_collapses_newlines():
    assert strip_html("<p>line1</p>\n<p>line2</p>") == "line1 line2"


def test_strip_html_none():
    assert strip_html(None) is None
    assert strip_html("") is None


# --- nested EFSA / legislation ------------------------------------------

def test_efsa_references_extracts_nested_map():
    item = make_node("root", None, [
        make_node("hcEfsaOpinionReferenceMap", None, [
            make_node("hcEfsaQuestionNbr", "Q-2021-00073"),
            make_node("hcEfsaQuestionUrl", "https://efsa.example/73"),
        ]),
    ])
    assert efsa_references(item) == [
        {"reference": "Q-2021-00073", "url": "https://efsa.example/73"}
    ]


def test_efsa_references_skips_empty():
    item = make_node("root", None, [make_node("hcEfsaOpinionReferenceMap", None, [])])
    assert efsa_references(item) == []


def test_legislations_extracts_nested_fields():
    item = make_node("root", None, [
        make_node("hcLegislationsComplex", None, [
            make_node("hcLegalActPubType", "HCPT_ADDITION"),
            make_node("hcLegislation", "1945255"),
            make_node("hcEurLexUrl", "https://eurlex/1945255"),
        ]),
    ])
    assert legislations(item) == [
        {"act": "HCPT_ADDITION", "legislation": "1945255", "eurlex_url": "https://eurlex/1945255"}
    ]


# --- parse_item ----------------------------------------------------------

def test_parse_item_maps_codes_and_flattens():
    item = make_node("policyItemObject", None, [
        make_node("policyItemCode", "POL-HC-6510"),
        make_node("hcClaimStatus", "HCCS_AUTHORISED"),
        make_node("hcClaimType", "HCLBT_13_1"),
        make_node("hcClaim", "<p>Vitamin C contributes to the normal function of the immune system</p>"),
        make_node("hcHealthRelationship", "maintenance of the normal function of the immune system"),
        make_node("hcCondOfUse", "<p>Use only for food which contains 1 g per portion</p>"),
        make_node("hcEntryId", "101"),
        make_node("hcProtectDataGrantedForClaim", "no"),
    ])
    rec = parse_item(item)
    assert rec["policy_item_code"] == "POL-HC-6510"
    assert rec["status"] == "authorised"
    assert rec["claim_type"] == "Art. 13(1)"
    assert rec["claim_text"] == "Vitamin C contributes to the normal function of the immune system"
    assert rec["conditions_of_use"] == "Use only for food which contains 1 g per portion"
    assert rec["substances_or_entries"] == ["101"]
    assert rec["data_protection"] == "no"


def test_parse_item_handles_missing_fields():
    item = make_node("policyItemObject", None, [
        make_node("policyItemCode", "POL-HC-0000"),
        make_node("hcClaim", "no structure"),
    ])
    rec = parse_item(item)
    assert rec["policy_item_code"] == "POL-HC-0000"
    assert rec["status"] is None  # unknown status code
    assert rec["efsa_references"] == []
    assert rec["legislation"] == []
    assert rec["applicant_country"] is None


def test_parse_item_handles_repeated_reasons():
    item = make_node("policyItemObject", None, [
        make_node("policyItemCode", "POL-HC-7424"),
        make_node("hcClaimStatus", "HCCS_NON_AUTHORISED"),
        make_node("hcReasonsForNonAuth", "HC_RR_132"),
        make_node("hcReasonsForNonAuth", "HC_RR_135"),
    ])
    rec = parse_item(item)
    assert rec["reasons_for_non_auth"] == ["HC_RR_132", "HC_RR_135"]


def test_status_map_contains_all_codes():
    assert STATUS_MAP["HCCS_AUTHORISED"] == "authorised"
    assert STATUS_MAP["HCCS_NON_AUTHORISED"] == "non_authorised"
    assert STATUS_MAP["HCCS_REVOKED"] == "revoked"


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("<p>a</p><p>b</p>", "a b"),
        ("<ul><li>x</li><li>y</li></ul>", "x y"),
        ("   spaced   out   ", "spaced out"),
    ],
)
def test_strip_html_parametrized(raw, expected):
    assert strip_html(raw) == expected
