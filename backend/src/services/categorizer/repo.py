"""
repo.py — Database access layer for the categorization pipeline.

All queries use asyncpg parameterized syntax ($1, $2, …).
No string interpolation of user-supplied values anywhere in this module.

Functions are grouped:
  - Read queries (safe outside transactions)
  - Write operations (must be called inside a transaction)
"""
from __future__ import annotations

from typing import Optional

import asyncpg


# ---------------------------------------------------------------------------
# Read queries
# ---------------------------------------------------------------------------


async def lookup_by_alias(
    conn: asyncpg.Connection, normalized_name: str
) -> Optional[dict]:
    """
    Exact match on merchant_aliases.normalized_name (CITEXT — case-insensitive).
    Returns {merchant_id, category_id, source, confidence, model_version} or None.
    """
    row = await conn.fetchrow(
        """
        SELECT
            m.id            AS merchant_id,
            mc.category_id,
            mc.source,
            mc.confidence,
            mc.model_version
        FROM merchant_aliases ma
        JOIN merchants        m  ON ma.merchant_id  = m.id
        JOIN merchant_category mc ON mc.merchant_id = m.id
        WHERE ma.normalized_name = $1
        LIMIT 1
        """,
        normalized_name,
    )
    return _to_lookup(row)


async def lookup_by_merchant(
    conn: asyncpg.Connection, normalized_name: str
) -> Optional[dict]:
    """
    Exact match on merchants.normalized_name (CITEXT).
    Returns {merchant_id, category_id, source, confidence, model_version} or None.
    """
    row = await conn.fetchrow(
        """
        SELECT
            m.id            AS merchant_id,
            mc.category_id,
            mc.source,
            mc.confidence,
            mc.model_version
        FROM merchants        m
        JOIN merchant_category mc ON mc.merchant_id = m.id
        WHERE m.normalized_name = $1
        LIMIT 1
        """,
        normalized_name,
    )
    return _to_lookup(row)


async def fuzzy_lookup(
    conn: asyncpg.Connection, normalized_name: str, threshold: float
) -> Optional[dict]:
    """
    pg_trgm similarity search against merchants.normalized_name.
    Returns the best match if similarity >= threshold, else None.
    The returned confidence reflects the stored mapping confidence, not
    the trigram similarity score.
    """
    row = await conn.fetchrow(
        """
        SELECT
            m.id            AS merchant_id,
            mc.category_id,
            mc.source,
            mc.confidence,
            mc.model_version,
            similarity(m.normalized_name, $1) AS sim
        FROM merchants        m
        JOIN merchant_category mc ON mc.merchant_id = m.id
        WHERE similarity(m.normalized_name, $1) >= $2
        ORDER BY sim DESC
        LIMIT 1
        """,
        normalized_name,
        threshold,
    )
    return _to_lookup(row)


async def get_active_categories(conn: asyncpg.Connection) -> list[dict]:
    """
    All active categories ordered by sort_order.
    [{"id": int, "key": str, "label": str, "parent_id": int | None}, ...]
    """
    rows = await conn.fetch(
        """
        SELECT id, key, label, parent_id
        FROM categories
        WHERE is_active = TRUE
        ORDER BY sort_order, id
        """,
    )
    return [
        {
            "id": int(r["id"]),
            "key": str(r["key"]),
            "label": str(r["label"]),
            "parent_id": int(r["parent_id"]) if r["parent_id"] is not None else None,
        }
        for r in rows
    ]


async def get_other_category_id(conn: asyncpg.Connection) -> Optional[int]:
    """Returns the 'other' fallback category id, or None if not seeded."""
    row = await conn.fetchrow(
        "SELECT id FROM categories WHERE key = 'other' AND is_active = TRUE",
    )
    return int(row["id"]) if row else None


async def get_category_label_map(conn: asyncpg.Connection) -> dict[int, dict]:
    """
    Returns {category_id: {"category": str, "subcategory": str | None}}.

    - Leaf category (has parent_id): category = parent.label,
                                      subcategory = leaf.label
    - Top-level category (no parent): category = leaf.label,
                                       subcategory = None
    """
    rows = await conn.fetch(
        """
        SELECT
            c.id,
            c.label       AS leaf_label,
            p.label       AS parent_label
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        WHERE c.is_active = TRUE
        """,
    )
    result: dict[int, dict] = {}
    for r in rows:
        cat_id = int(r["id"])
        if r["parent_label"]:
            result[cat_id] = {
                "category": str(r["parent_label"]),
                "subcategory": str(r["leaf_label"]),
            }
        else:
            result[cat_id] = {
                "category": str(r["leaf_label"]),
                "subcategory": None,
            }
    return result


# ---------------------------------------------------------------------------
# Write operations (must be called inside a transaction)
# ---------------------------------------------------------------------------


async def upsert_merchant(
    conn: asyncpg.Connection,
    normalized_name: str,
    display_name: str,
) -> str:
    """
    Insert or touch merchant row.  Returns the UUID as a string.
    On conflict (same normalized_name) just refreshes updated_at so we
    always get the existing id back via RETURNING.
    """
    row = await conn.fetchrow(
        """
        INSERT INTO merchants (normalized_name, display_name, country_code)
        VALUES ($1, $2, 'PH')
        ON CONFLICT (normalized_name) DO UPDATE
            SET updated_at = now()
        RETURNING id
        """,
        normalized_name,
        display_name,
    )
    return str(row["id"])


async def bump_alias(
    conn: asyncpg.Connection,
    merchant_id: str,
    raw_string: str,
    normalized_name: str,
) -> None:
    """
    Insert alias or increment occurrence_count if the alias already exists.
    """
    await conn.execute(
        """
        INSERT INTO merchant_aliases
            (merchant_id, raw_string, normalized_name, occurrence_count)
        VALUES ($1::uuid, $2, $3, 1)
        ON CONFLICT (normalized_name) DO UPDATE
            SET occurrence_count = merchant_aliases.occurrence_count + 1,
                last_seen_at     = now()
        """,
        merchant_id,
        raw_string,
        normalized_name,
    )


async def upsert_merchant_category(
    conn: asyncpg.Connection,
    merchant_id: str,
    category_id: int,
    source: str,
    confidence: float,
    model_version: Optional[str],
) -> None:
    """
    Set or update the merchant's active category mapping.
    Never overwrites a human_verified mapping.
    """
    await conn.execute(
        """
        INSERT INTO merchant_category
            (merchant_id, category_id, source, confidence, model_version, updated_at)
        VALUES ($1::uuid, $2, $3::category_source, $4, $5, now())
        ON CONFLICT (merchant_id) DO UPDATE
            SET category_id   = EXCLUDED.category_id,
                source        = EXCLUDED.source,
                confidence    = EXCLUDED.confidence,
                model_version = EXCLUDED.model_version,
                updated_at    = now()
        WHERE merchant_category.source <> 'human_verified'
        """,
        merchant_id,
        category_id,
        source,
        confidence,
        model_version,
    )


async def upsert_unresolved(
    conn: asyncpg.Connection,
    raw_string: str,
    normalized_name: str,
    best_guess_id: Optional[int],
    best_confidence: Optional[float],
) -> None:
    """
    Park a low-confidence string in the unresolved queue.
    Increments occurrence_count and keeps the best guess when it improves.
    """
    await conn.execute(
        """
        INSERT INTO unresolved_queue
            (raw_string, normalized_name, best_guess_id, best_confidence)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (normalized_name) DO UPDATE
            SET occurrence_count = unresolved_queue.occurrence_count + 1,
                best_guess_id = CASE
                    WHEN EXCLUDED.best_confidence IS NOT NULL
                         AND (unresolved_queue.best_confidence IS NULL
                              OR EXCLUDED.best_confidence > unresolved_queue.best_confidence)
                    THEN EXCLUDED.best_guess_id
                    ELSE unresolved_queue.best_guess_id
                END,
                best_confidence = GREATEST(
                    unresolved_queue.best_confidence,
                    EXCLUDED.best_confidence
                )
        """,
        raw_string,
        normalized_name,
        best_guess_id,
        best_confidence,
    )


async def insert_categorization_log(
    conn: asyncpg.Connection,
    raw_string: str,
    merchant_id: Optional[str],
    category_id: Optional[int],
    source: str,
    confidence: Optional[float],
    model_version: Optional[str],
) -> None:
    """
    Append an audit row.  Called for every categorization, including
    cascade hits.
    """
    await conn.execute(
        """
        INSERT INTO categorization_log
            (raw_string, merchant_id, category_id, source, confidence, model_version)
        VALUES ($1, $2::uuid, $3, $4::category_source, $5, $6)
        """,
        raw_string,
        merchant_id,
        category_id,
        source,
        confidence,
        model_version,
    )


async def insert_request_log(
    conn: asyncpg.Connection,
    batch_size: int,
    latency_ms: int,
    llm_calls: int,
    cache_hits: int,
) -> None:
    """
    Append a request-level audit row.  Captures throughput and LLM usage
    per /api/categorize call.  Non-fatal — caller should swallow exceptions.
    """
    await conn.execute(
        """
        INSERT INTO request_log
            (batch_size, latency_ms, llm_calls, cache_hits)
        VALUES ($1, $2, $3, $4)
        """,
        batch_size,
        latency_ms,
        llm_calls,
        cache_hits,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _to_lookup(row) -> Optional[dict]:
    if row is None:
        return None
    return {
        "merchant_id": str(row["merchant_id"]),
        "category_id": int(row["category_id"]),
        "source": str(row["source"]),
        "confidence": float(row["confidence"]),
        "model_version": row["model_version"],
    }
