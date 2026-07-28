"""
Proprietary merchant categorization — the GastosIn moat.
Backend only. Never expose this logic client-side.

Architecture (two layers):
  Layer 1 (primary)  — DB-backed CategorizationService:
      normalize → cascade DB lookup → LLM fallback → write-back
  Layer 2 (fallback) — in-memory BASE_MAPPINGS:
      used when the DB pool is not yet initialised (e.g. unit tests,
      dev without a database, startup before the pool is ready).

The public interface `categorize_transactions` is unchanged.
"""
from __future__ import annotations

import logging
from typing import Optional

from src.models import Transaction, CategorizedTransaction

logger = logging.getLogger("gastosin.categorizer")

# ---------------------------------------------------------------------------
# Base mappings — common Philippine merchants
# key: lowercase merchant substring → (category, subcategory)
# Expand this as GastosIn grows. This list IS the moat.
# ---------------------------------------------------------------------------
BASE_MAPPINGS: list[tuple[str, str, str]] = [
    # Groceries
    ("sm supermarket", "Groceries", "Supermarket"),
    ("robinsons supermarket", "Groceries", "Supermarket"),
    ("puregold", "Groceries", "Supermarket"),
    ("rustan", "Groceries", "Supermarket"),
    ("landers", "Groceries", "Supermarket"),
    ("s&r", "Groceries", "Warehouse Club"),

    # Food & Dining
    ("jollibee", "Food & Dining", "Fast Food"),
    ("mcdonalds", "Food & Dining", "Fast Food"),
    ("mcdonald's", "Food & Dining", "Fast Food"),
    ("kfc", "Food & Dining", "Fast Food"),
    ("chowking", "Food & Dining", "Fast Food"),
    ("greenwich", "Food & Dining", "Fast Food"),
    ("goldilocks", "Food & Dining", "Bakery"),
    ("red ribbon", "Food & Dining", "Bakery"),
    ("starbucks", "Food & Dining", "Coffee"),
    ("bo's coffee", "Food & Dining", "Coffee"),
    ("figaro", "Food & Dining", "Coffee"),
    ("grab food", "Food & Dining", "Delivery"),
    ("foodpanda", "Food & Dining", "Delivery"),

    # Transport
    ("grab", "Transport", "Rideshare"),
    ("angkas", "Transport", "Rideshare"),
    ("move it", "Transport", "Rideshare"),
    ("lrt", "Transport", "Rail"),
    ("mrt", "Transport", "Rail"),
    ("beep", "Transport", "Rail"),
    ("meralco", "Utilities", "Electricity"),
    ("maynilad", "Utilities", "Water"),
    ("manila water", "Utilities", "Water"),

    # Telecoms
    ("globe", "Telecoms", "Mobile"),
    ("smart", "Telecoms", "Mobile"),
    ("dito", "Telecoms", "Mobile"),
    ("converge", "Telecoms", "Internet"),
    ("pldt", "Telecoms", "Internet"),

    # Shopping
    ("lazada", "Shopping", "E-commerce"),
    ("shopee", "Shopping", "E-commerce"),
    ("zalora", "Shopping", "E-commerce"),
    ("h&m", "Shopping", "Clothing"),
    ("uniqlo", "Shopping", "Clothing"),
    ("sm store", "Shopping", "Department Store"),
    ("robinsons department", "Shopping", "Department Store"),

    # Health
    ("mercury drug", "Health", "Pharmacy"),
    ("rose pharmacy", "Health", "Pharmacy"),
    ("generika", "Health", "Pharmacy"),
    ("watsons", "Health", "Pharmacy"),

    # Entertainment
    ("netflix", "Entertainment", "Streaming"),
    ("spotify", "Entertainment", "Streaming"),
    ("youtube", "Entertainment", "Streaming"),
    ("sm cinema", "Entertainment", "Cinema"),
    ("ayala cinemas", "Entertainment", "Cinema"),

    # Financial
    ("gcash", "Financial", "E-wallet"),
    ("paymaya", "Financial", "E-wallet"),
    ("maya", "Financial", "E-wallet"),
]


# ---------------------------------------------------------------------------
# Layer 2: in-memory fallback
# ---------------------------------------------------------------------------

def _match_merchant(merchant: str) -> tuple[str, Optional[str]]:
    """Substring match on lowercased merchant; falls back to ("Other", None)."""
    merchant_lower = merchant.lower()
    for keyword, category, subcategory in BASE_MAPPINGS:
        if keyword in merchant_lower:
            return category, subcategory
    return "Other", None


async def _fallback_categorize(
    transactions: list[Transaction],
) -> list[CategorizedTransaction]:
    results = []
    for txn in transactions:
        category, subcategory = _match_merchant(txn.merchant)
        results.append(
            CategorizedTransaction(
                date=txn.date,
                merchant=txn.merchant,
                amount=txn.amount,
                category=category,
                subcategory=subcategory,
            )
        )
    return results


# ---------------------------------------------------------------------------
# Layer 1: DB-backed service
# ---------------------------------------------------------------------------

def _make_service():
    """Build a CategorizationService from the live pool and settings."""
    from src.db import get_pool
    from src.config import settings
    from src.services.categorizer.service import (
        CategorizationService,
        CategorizationConfig,
    )
    from src.services.categorizer.llm_client import LLMClient

    pool = get_pool()  # raises RuntimeError if pool is not yet initialised
    config = CategorizationConfig(
        confidence_threshold=settings.LLM_CONFIDENCE_THRESHOLD,
        fuzzy_threshold=settings.LLM_FUZZY_THRESHOLD,
        model_version=settings.LLM_MODEL,
    )
    return CategorizationService(config=config, pool=pool, llm=LLMClient(settings))


# ---------------------------------------------------------------------------
# Public entry point (unchanged signature)
# ---------------------------------------------------------------------------

async def categorize_transactions(
    transactions: list[Transaction],
) -> tuple[list[CategorizedTransaction], int, int]:
    """
    Categorize a list of sanitized transactions.

    Primary path  : DB-backed CategorizationService (cascade + LLM).
    Fallback path : in-memory BASE_MAPPINGS when the DB pool is absent.

    Returns (categorized_transactions, llm_calls, cache_hits).
    """
    try:
        service = _make_service()
    except (RuntimeError, ImportError) as exc:
        logger.warning(
            "DB service unavailable, using in-memory fallback: %s", exc
        )
        fallback = await _fallback_categorize(transactions)
        return fallback, 0, len(transactions)

    merchant_strings = [t.merchant for t in transactions]
    results = await service.categorize_batch(merchant_strings)

    # Resolve category_id → display labels via DB
    category_labels: dict[int, dict] = {}
    try:
        from src.db import get_pool
        from src.services.categorizer import repo

        async with get_pool().acquire() as conn:
            category_labels = await repo.get_category_label_map(conn)
    except Exception as exc:
        logger.warning("Could not fetch category label map: %s", exc)

    output: list[CategorizedTransaction] = []
    for txn, result in zip(transactions, results):
        if result.category_id and result.category_id in category_labels:
            info = category_labels[result.category_id]
            category: str = info["category"]
            subcategory: Optional[str] = info["subcategory"]
        else:
            category, subcategory = _match_merchant(txn.merchant)

        output.append(
            CategorizedTransaction(
                date=txn.date,
                merchant=txn.merchant,
                amount=txn.amount,
                category=category,
                subcategory=subcategory,
            )
        )

    llm_calls = sum(1 for r in results if r.source == "llm")
    cache_hits = len(results) - llm_calls

    return output, llm_calls, cache_hits
