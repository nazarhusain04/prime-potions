"""
Unit tests for excel_services helper functions
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from excel_services import fuzzy_match_column, DEFAULT_RAW_MATERIAL_MAPPINGS


class TestFuzzyMatchColumn:
    """Tests for fuzzy_match_column()"""

    def test_exact_match(self):
        result = fuzzy_match_column("SKU", DEFAULT_RAW_MATERIAL_MAPPINGS)
        assert result == "item_code"

    def test_case_insensitive_partial_match(self):
        result = fuzzy_match_column("item name (product)", DEFAULT_RAW_MATERIAL_MAPPINGS)
        assert result == "name"

    def test_no_match_returns_none(self):
        result = fuzzy_match_column("Completely Unrelated Column", DEFAULT_RAW_MATERIAL_MAPPINGS)
        assert result is None
