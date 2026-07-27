"""
Tests for the CategorizationService.

Sections:
  1. TestNormalize     — pure function, no mocks
  2. TestCascadeAlias  — alias hit stops cascade, LLM never called
  3. TestCascadeMerchant — alias miss, merchant hit
  4. TestCascadeFuzzy  — alias+merchant miss, fuzzy hit
  5. TestLLMFallback   — full cascade miss → LLM called
  6. TestWriteBackConfident   — confidence >= threshold → upsert merchant
  7. TestWriteBackUnconfident — confidence < threshold → unresolved queue
  8. TestBatchDedup    — same normalized name processed only once
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.categorizer.normalize import normalize
from src.services.categorizer.service import (
    CategorizationService,
    CategorizationConfig,
)


# ---------------------------------------------------------------------------
# Shared fixtures / helpers
# ---------------------------------------------------------------------------

_CATEGORIES = [
    {"id": 1, "key": "food_dining", "label": "Food & Dining", "parent_id": None},
    {"id": 2, "key": "fast_food",   "label": "Fast Food",     "parent_id": 1},
    {"id": 99, "key": "other",      "label": "Other",          "parent_id": None},
]

_CASCADE_HIT = {
    "merchant_id": "00000000-0000-0000-0000-000000000001",
    "category_id": 2,
    "source": "rule",
    "confidence": 1.0,
    "model_version": None,
}


def _pool_stub():
    """
    Minimal pool mock.  pool.acquire() yields the same connection stub
    on every call, which is fine because tests patch repo functions
    directly rather than inspecting raw DB calls.
    """
    conn = MagicMock()
    txn = MagicMock()
    txn.__aenter__ = AsyncMock(return_value=None)
    txn.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=txn)

    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=conn)
    ctx.__aexit__ = AsyncMock(return_value=False)

    pool = MagicMock()
    pool.acquire = MagicMock(return_value=ctx)
    return pool


def _svc(llm=None, **cfg_kwargs):
    """Helper: build a CategorizationService with a stub pool."""
    return CategorizationService(
        config=CategorizationConfig(**cfg_kwargs),
        pool=_pool_stub(),
        llm=llm or AsyncMock(),
    )


# Convenience: patch all six repo functions used by the service at once.
_REPO = "src.services.categorizer.service.repo"


# ---------------------------------------------------------------------------
# 1. normalize()
# ---------------------------------------------------------------------------

class TestNormalize:
    def test_paypal_star_trailing_id(self):
        assert normalize("PAYPAL *NBA LG PASS, [ID]") == "paypal nba lg pass"

    def test_sq_processor_and_location_stripped(self):
        assert normalize("SQ *STARBUCKS BGC") == "starbucks"

    def test_sm_supermarket_location_stripped(self):
        assert normalize("SM SUPERMARKET MAKATI") == "sm supermarket"

    def test_lowercase_only(self):
        assert normalize("JOLLIBEE") == "jollibee"

    def test_collapses_internal_whitespace(self):
        assert normalize("  SM   NORTH  ") == "sm north"

    def test_empty_string_returns_empty(self):
        assert normalize("") == ""

    def test_punctuation_removed(self):
        assert normalize("JOLLIBEE, SM NORTH EDSA") == "jollibee sm north edsa"

    def test_amzn_mktp_processor_stripped(self):
        assert normalize("AMZN MKTP *BOOK TITLE") == "book title"

    def test_trailing_bracket_only(self):
        assert normalize("MERCURY DRUG [PH-123]") == "mercury drug"

    def test_no_change_needed(self):
        assert normalize("grab") == "grab"

    def test_unicode_punctuation_replaced_with_space(self):
        # smart apostrophe → space (punct is replaced with " ", not deleted)
        assert normalize("BO\u2019S COFFEE") == "bo s coffee"

    def test_multiple_bracketed_tokens_only_last_stripped(self):
        # Only the final bracket token is stripped (trailing)
        result = normalize("MERCHANT [AB] [ID]")
        assert result == "merchant ab"

    def test_location_at_start_not_stripped(self):
        # "makati" here is not at the end, so should be kept
        assert normalize("MAKATI MEDICAL CENTER") == "makati medical center"


# ---------------------------------------------------------------------------
# 2. Cascade: alias hit
# ---------------------------------------------------------------------------

class TestCascadeAlias:
    @pytest.mark.asyncio
    async def test_alias_hit_returns_result_and_skips_merchant_fuzzy_llm(self):
        llm = AsyncMock()
        svc = _svc(llm=llm)

        mock_merch = AsyncMock(return_value=None)
        mock_fuzzy = AsyncMock(return_value=None)

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=_CASCADE_HIT)),
            patch(f"{_REPO}.lookup_by_merchant",         new=mock_merch),
            patch(f"{_REPO}.fuzzy_lookup",               new=mock_fuzzy),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            result = await svc.categorize("JOLLIBEE MAKATI")

        assert result.category_id == 2
        assert result.source == "rule"
        assert result.confidence == 1.0
        llm.categorize.assert_not_called()
        mock_merch.assert_not_called()
        mock_fuzzy.assert_not_called()


# ---------------------------------------------------------------------------
# 3. Cascade: alias miss, merchant hit
# ---------------------------------------------------------------------------

class TestCascadeMerchant:
    @pytest.mark.asyncio
    async def test_merchant_hit_after_alias_miss(self):
        llm = AsyncMock()
        svc = _svc(llm=llm)

        merch_hit = {**_CASCADE_HIT, "source": "import", "confidence": 0.9}
        mock_fuzzy = AsyncMock(return_value=None)

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=merch_hit)),
            patch(f"{_REPO}.fuzzy_lookup",               new=mock_fuzzy),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            result = await svc.categorize("GRAB RIDE")

        assert result.category_id == 2
        assert result.source == "import"
        llm.categorize.assert_not_called()
        mock_fuzzy.assert_not_called()


# ---------------------------------------------------------------------------
# 4. Cascade: fuzzy hit
# ---------------------------------------------------------------------------

class TestCascadeFuzzy:
    @pytest.mark.asyncio
    async def test_fuzzy_hit_after_exact_misses(self):
        llm = AsyncMock()
        svc = _svc(llm=llm, fuzzy_threshold=0.45)

        fuzzy_hit = {**_CASCADE_HIT, "source": "rule", "confidence": 0.85}

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.fuzzy_lookup",               new=AsyncMock(return_value=fuzzy_hit)),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            result = await svc.categorize("JOLIBEE SM NORTH")  # typo → fuzzy

        assert result.category_id == 2
        llm.categorize.assert_not_called()


# ---------------------------------------------------------------------------
# 5. LLM fallback (full cascade miss)
# ---------------------------------------------------------------------------

class TestLLMFallback:
    @pytest.mark.asyncio
    async def test_cascade_miss_calls_llm(self):
        llm = AsyncMock()
        llm.categorize = AsyncMock(
            return_value={"category_key": "fast_food", "confidence": 0.91}
        )
        svc = _svc(llm=llm, confidence_threshold=0.75)

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.fuzzy_lookup",               new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.get_active_categories",      new=AsyncMock(return_value=_CATEGORIES)),
            patch(f"{_REPO}.upsert_merchant",            new=AsyncMock(return_value="uuid-new")),
            patch(f"{_REPO}.bump_alias",                 new=AsyncMock()),
            patch(f"{_REPO}.upsert_merchant_category",   new=AsyncMock()),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            result = await svc.categorize("TOTALLY NEW BURGER JOINT")

        llm.categorize.assert_called_once()
        assert result.source == "llm"

    @pytest.mark.asyncio
    async def test_llm_unknown_category_treated_as_low_confidence(self):
        llm = AsyncMock()
        llm.categorize = AsyncMock(
            return_value={"category_key": "unknown", "confidence": 0.0}
        )
        svc = _svc(llm=llm, confidence_threshold=0.75)

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.fuzzy_lookup",               new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.get_active_categories",      new=AsyncMock(return_value=_CATEGORIES)),
            patch(f"{_REPO}.upsert_unresolved",          new=AsyncMock()),
            patch(f"{_REPO}.get_other_category_id",      new=AsyncMock(return_value=99)),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            result = await svc.categorize("MYSTERY CHARGE 99")

        assert result.category_id == 99


# ---------------------------------------------------------------------------
# 6. Write-back: confident result
# ---------------------------------------------------------------------------

class TestWriteBackConfident:
    @pytest.mark.asyncio
    async def test_confident_result_upserts_merchant_and_alias(self):
        llm = AsyncMock()
        llm.categorize = AsyncMock(
            return_value={"category_key": "fast_food", "confidence": 0.92}
        )
        svc = _svc(llm=llm, confidence_threshold=0.75)

        mock_upsert_merchant = AsyncMock(return_value="uuid-created")
        mock_bump = AsyncMock()
        mock_upsert_mc = AsyncMock()
        mock_unresolved = AsyncMock()

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.fuzzy_lookup",               new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.get_active_categories",      new=AsyncMock(return_value=_CATEGORIES)),
            patch(f"{_REPO}.upsert_merchant",            new=mock_upsert_merchant),
            patch(f"{_REPO}.bump_alias",                 new=mock_bump),
            patch(f"{_REPO}.upsert_merchant_category",   new=mock_upsert_mc),
            patch(f"{_REPO}.upsert_unresolved",          new=mock_unresolved),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            result = await svc.categorize("NEW FAST FOOD CHAIN")

        assert result.category_id == 2  # fast_food id
        assert result.merchant_id == "uuid-created"
        mock_upsert_merchant.assert_called_once()
        mock_bump.assert_called_once()
        mock_upsert_mc.assert_called_once()
        mock_unresolved.assert_not_called()


# ---------------------------------------------------------------------------
# 7. Write-back: unconfident result
# ---------------------------------------------------------------------------

class TestWriteBackUnconfident:
    @pytest.mark.asyncio
    async def test_low_confidence_writes_unresolved_returns_other(self):
        llm = AsyncMock()
        llm.categorize = AsyncMock(
            return_value={"category_key": "fast_food", "confidence": 0.50}
        )
        svc = _svc(llm=llm, confidence_threshold=0.75)

        mock_upsert_merchant = AsyncMock()
        mock_unresolved = AsyncMock()

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.fuzzy_lookup",               new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.get_active_categories",      new=AsyncMock(return_value=_CATEGORIES)),
            patch(f"{_REPO}.upsert_merchant",            new=mock_upsert_merchant),
            patch(f"{_REPO}.upsert_unresolved",          new=mock_unresolved),
            patch(f"{_REPO}.get_other_category_id",      new=AsyncMock(return_value=99)),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            result = await svc.categorize("SKETCHY PLACE 42")

        assert result.category_id == 99  # "Other"
        mock_unresolved.assert_called_once()
        mock_upsert_merchant.assert_not_called()

    @pytest.mark.asyncio
    async def test_exact_threshold_boundary_is_confident(self):
        """confidence == threshold should be treated as confident."""
        llm = AsyncMock()
        llm.categorize = AsyncMock(
            return_value={"category_key": "fast_food", "confidence": 0.75}
        )
        svc = _svc(llm=llm, confidence_threshold=0.75)

        mock_upsert_merchant = AsyncMock(return_value="uuid-exact")
        mock_unresolved = AsyncMock()

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.fuzzy_lookup",               new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.get_active_categories",      new=AsyncMock(return_value=_CATEGORIES)),
            patch(f"{_REPO}.upsert_merchant",            new=mock_upsert_merchant),
            patch(f"{_REPO}.bump_alias",                 new=AsyncMock()),
            patch(f"{_REPO}.upsert_merchant_category",   new=AsyncMock()),
            patch(f"{_REPO}.upsert_unresolved",          new=mock_unresolved),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            result = await svc.categorize("BOUNDARY MERCHANT")

        mock_upsert_merchant.assert_called_once()
        mock_unresolved.assert_not_called()
        assert result.category_id == 2


# ---------------------------------------------------------------------------
# 8. Batch deduplication
# ---------------------------------------------------------------------------

class TestBatchDedup:
    @pytest.mark.asyncio
    async def test_same_normalized_name_triggers_single_llm_call(self):
        """
        'JOLLIBEE MAKATI' and 'JOLLIBEE BGC' both normalize to 'jollibee'.
        The LLM should be called at most once for 'jollibee'.
        """
        llm = AsyncMock()
        llm.categorize = AsyncMock(
            return_value={"category_key": "fast_food", "confidence": 0.88}
        )
        svc = _svc(llm=llm, confidence_threshold=0.75)

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.fuzzy_lookup",               new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.get_active_categories",      new=AsyncMock(return_value=_CATEGORIES)),
            patch(f"{_REPO}.upsert_merchant",            new=AsyncMock(return_value="uuid-j")),
            patch(f"{_REPO}.bump_alias",                 new=AsyncMock()),
            patch(f"{_REPO}.upsert_merchant_category",   new=AsyncMock()),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            results = await svc.categorize_batch(
                ["JOLLIBEE MAKATI", "JOLLIBEE BGC", "JOLLIBEE TAGUIG"]
            )

        # Three inputs all normalize to "jollibee" → one LLM call
        assert llm.categorize.call_count == 1
        assert len(results) == 3
        assert all(r.category_id == 2 for r in results)

    @pytest.mark.asyncio
    async def test_different_normalized_names_each_get_llm_call(self):
        llm = AsyncMock()
        llm.categorize = AsyncMock(
            return_value={"category_key": "fast_food", "confidence": 0.85}
        )
        svc = _svc(llm=llm, confidence_threshold=0.75)

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.fuzzy_lookup",               new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.get_active_categories",      new=AsyncMock(return_value=_CATEGORIES)),
            patch(f"{_REPO}.upsert_merchant",            new=AsyncMock(return_value="uuid-x")),
            patch(f"{_REPO}.bump_alias",                 new=AsyncMock()),
            patch(f"{_REPO}.upsert_merchant_category",   new=AsyncMock()),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            results = await svc.categorize_batch(["GRAB", "LAZADA", "NETFLIX"])

        # Three distinct normalized names → three LLM calls
        assert llm.categorize.call_count == 3
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_batch_preserves_input_order(self):
        """Results must map 1-to-1 with input strings in original order."""
        llm = AsyncMock()
        llm.categorize = AsyncMock(
            return_value={"category_key": "fast_food", "confidence": 0.9}
        )
        svc = _svc(llm=llm)

        inputs = ["GRAB", "JOLLIBEE MAKATI", "GRAB", "JOLLIBEE BGC", "NETFLIX"]

        with (
            patch(f"{_REPO}.lookup_by_alias",           new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.lookup_by_merchant",         new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.fuzzy_lookup",               new=AsyncMock(return_value=None)),
            patch(f"{_REPO}.get_active_categories",      new=AsyncMock(return_value=_CATEGORIES)),
            patch(f"{_REPO}.upsert_merchant",            new=AsyncMock(return_value="uuid-any")),
            patch(f"{_REPO}.bump_alias",                 new=AsyncMock()),
            patch(f"{_REPO}.upsert_merchant_category",   new=AsyncMock()),
            patch(f"{_REPO}.insert_categorization_log",  new=AsyncMock()),
        ):
            results = await svc.categorize_batch(inputs)

        assert len(results) == len(inputs)
        # "GRAB" at index 0 and 2 should get the same result object
        assert results[0] is results[2]
        # "JOLLIBEE MAKATI" and "JOLLIBEE BGC" normalize to same → same result
        assert results[1] is results[3]
