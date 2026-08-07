"""Unit tests for ingredient detection (no infrastructure required)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from store.seed import detect_ingredients  # noqa: E402


def test_detects_vitamin_c_canonical():
    assert detect_ingredients("Vitamin C contributes to the immune system") == ["Vitamin C"]


def test_detects_ascorbic_as_vitamin_c():
    assert detect_ingredients("Ascorbic acid is needed for wound healing") == ["Vitamin C"]


def test_detects_multiple_ingredients_deduped():
    found = detect_ingredients("Vitamin C and calcium together with magnesium and more Vitamin C")
    assert found == ["Vitamin C", "Calcium", "Magnesium"]


def test_omega3_variants_canonicalized():
    assert detect_ingredients("Omega-3 fatty acids support heart health") == ["Omega-3 fatty acids"]
    assert detect_ingredients("omega 3 helps vision") == ["Omega-3 fatty acids"]


def test_epa_and_dha():
    found = detect_ingredients("EPA and DHA contribute to the normal function of the heart")
    assert "Omega-3 (EPA)" in found
    assert "Omega-3 (DHA)" in found


def test_no_false_positive_on_plain_text():
    assert detect_ingredients("This claim has no matching substance") == []


def test_empty_text_returns_empty():
    assert detect_ingredients("") == []
    assert detect_ingredients(None) == []


def test_glucomannan_and_collagen():
    assert detect_ingredients("Glucomannan in an energy restricted diet") == ["Glucomannan"]
    assert detect_ingredients("collagen supports skin") == ["Collagen"]


def test_case_insensitive():
    assert detect_ingredients("vItAmIn C") == ["Vitamin C"]
