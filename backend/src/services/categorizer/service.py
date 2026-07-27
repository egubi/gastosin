"""
service.py — CategorizationService: full merchant categorization pipeline.

Pipeline per string:
 1. normalize(raw_string)
 2. Cascade lookup (cheapest → most expensive; stop at first hit):
    a. Exact alias lookup   (merchant_aliases.normalized_name)
    b. Exact merchant lookup (merchants.normalized_name)
    c. Fuzzy lookup          (pg_trgm similarity >= fuzzy_threshold)
    → Any hit: log + return immediately (no LLM call).
 3. LLM fallback (cascade miss only):
    - Fetch closed category list from DB.
    - Ask LLM for { category_key, confidence }.
 4. Write-back (all writes in a single transaction):
    - confidence >= threshold AND known key:
        upsert merchants, bump merchant_aliases, upsert merchant_category.
    - else:
        upsert unresolved_queue; return 'other' category as safe default.
    - Always: insert categorization_log.

DB connections are released before the (potentially slow) LLM call to
avoid holding a pool connection idle during the network round-trip.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import asyncpg

from src.services.categorizer.normalize import normalize
from src.services.categorizer import repo
from src.services.categorizer.llm_client import LLMClient

logger = logging.getLogger("gastosin.categorizer")


# ---------------------------------------------------------------------------
# Config & result types
# ---------------------------------------------------------------------------


@dataclass
class CategorizationConfig:
    """All tuneable thresholds in one place — no hardcoded values in logic."""
    confidence_threshold: float = 0.75
    fuzzy_threshold: float = 0.45
    model_version: str = "gpt-4o-mini"


@dataclass
class CategorizeResult:
    category_id: Optional[int]
    confidence: float
    source: str  # matches category_source enum in Postgres
    merchant_id: Optional[str] = None  # UUID string when merchant was found/created


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class CategorizationService:
    def __init__(
        self,
        config: CategorizationConfig,
        pool: asyncpg.Pool,
        llm: LLMClient,
    ) -> None:
        self._config = config
        self._pool = pool
        self._llm = llm

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def categorize(self, raw_string: str) -> CategorizeResult:
        """
        Full pipeline for a single raw merchant string.

        Two-phase DB access so no connection is held while the LLM call
        is in flight:
          Phase 1 — fast reads (cascade + category fetch)
          Phase 2 — writes (single transaction)
        """
        normalized = normalize(raw_string)

        # --- Phase 1: reads ---------------------------------------------------
        categories: list[dict] = []
        async with self._pool.acquire() as conn:
            cascade = await self._cascade(conn, normalized)

            if cascade:
                async with conn.transaction():
                    await repo.insert_categorization_log(
                        conn,
                        raw_string=raw_string,
                        merchant_id=cascade["merchant_id"],
                        category_id=cascade["category_id"],
                        source=cascade["source"],
                        confidence=cascade["confidence"],
                        model_version=cascade["model_version"],
                    )
                return CategorizeResult(
                    category_id=cascade["category_id"],
                    confidence=cascade["confidence"],
                    source=cascade["source"],
                    merchant_id=cascade["merchant_id"],
                )

            categories = await repo.get_active_categories(conn)
        # ← connection released before LLM call

        # --- Phase 2: LLM (no connection held) --------------------------------
        llm_resp = await self._llm.categorize(normalized, categories)

        # --- Phase 3: writes (new connection, single transaction) --------------
        async with self._pool.acquire() as conn:
            return await self._write_back(
                conn, raw_string, normalized, llm_resp, categories
            )

    async def categorize_batch(self, strings: list[str]) -> list[CategorizeResult]:
        """
        Categorize a list of raw merchant strings.

        De-dupes by normalized_name before any DB/LLM work so that a
        statement with many rows for the same merchant makes at most one
        LLM call per unique normalized name.
        """
        # Build ordered unique list (preserving first occurrence order)
        seen: dict[str, Optional[CategorizeResult]] = {}
        unique: list[str] = []
        for s in strings:
            norm = normalize(s)
            if norm not in seen:
                seen[norm] = None
                unique.append(s)

        # Categorize each unique string and cache the result
        for s in unique:
            norm = normalize(s)
            seen[norm] = await self.categorize(s)

        # Map back to original input order
        return [seen[normalize(s)] for s in strings]  # type: ignore[misc]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _cascade(
        self, conn: asyncpg.Connection, normalized: str
    ) -> Optional[dict]:
        """Cascade lookup, cheapest first.  Returns first hit or None."""

        # a. Exact alias
        result = await repo.lookup_by_alias(conn, normalized)
        if result:
            logger.debug("alias hit for %r", normalized)
            return result

        # b. Exact merchant
        result = await repo.lookup_by_merchant(conn, normalized)
        if result:
            logger.debug("merchant hit for %r", normalized)
            return result

        # c. Fuzzy (pg_trgm)
        result = await repo.fuzzy_lookup(
            conn, normalized, self._config.fuzzy_threshold
        )
        if result:
            logger.debug(
                "fuzzy hit for %r (stored confidence %.2f)",
                normalized,
                result["confidence"],
            )
            return result

        return None

    async def _write_back(
        self,
        conn: asyncpg.Connection,
        raw_string: str,
        normalized: str,
        llm_resp: dict,
        categories: list[dict],
    ) -> CategorizeResult:
        """
        All DB writes in a single transaction.
        Returns the CategorizeResult with a resolved category_id.
        """
        category_key: str = llm_resp.get("category_key", "unknown")
        confidence: float = float(llm_resp.get("confidence", 0.0))

        # Resolve category_id from the key
        matched = next(
            (c for c in categories if c["key"] == category_key), None
        )
        category_id: Optional[int] = matched["id"] if matched else None

        confident = (
            category_id is not None
            and confidence >= self._config.confidence_threshold
        )

        merchant_id: Optional[str] = None
        final_category_id: Optional[int] = category_id

        async with conn.transaction():
            if confident:
                merchant_id = await repo.upsert_merchant(
                    conn, normalized, normalized
                )
                await repo.bump_alias(
                    conn, merchant_id, raw_string, normalized
                )
                await repo.upsert_merchant_category(
                    conn,
                    merchant_id=merchant_id,
                    category_id=category_id,  # type: ignore[arg-type]
                    source="llm",
                    confidence=confidence,
                    model_version=self._config.model_version,
                )
            else:
                await repo.upsert_unresolved(
                    conn,
                    raw_string=raw_string,
                    normalized_name=normalized,
                    best_guess_id=category_id,
                    best_confidence=confidence if category_id is not None else None,
                )
                final_category_id = await repo.get_other_category_id(conn)

            await repo.insert_categorization_log(
                conn,
                raw_string=raw_string,
                merchant_id=merchant_id,
                category_id=final_category_id,
                source="llm",
                confidence=confidence,
                model_version=self._config.model_version,
            )

        return CategorizeResult(
            category_id=final_category_id,
            confidence=confidence,
            source="llm",
            merchant_id=merchant_id,
        )
