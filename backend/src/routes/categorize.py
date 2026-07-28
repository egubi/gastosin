import logging
import time

from fastapi import APIRouter
from src.models import CategorizeRequest, CategorizeResponse
from src.services.categorizer import categorize_transactions

logger = logging.getLogger("gastosin.routes")
router = APIRouter()


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize(request: CategorizeRequest):
    """
    Accepts sanitized { date, merchant, amount } only.
    Returns the same list with category + subcategory appended.
    """
    t0 = time.perf_counter()
    categorized, llm_calls, cache_hits = await categorize_transactions(
        request.transactions
    )
    latency_ms = int((time.perf_counter() - t0) * 1000)

    try:
        from src.db import get_pool
        from src.services.categorizer import repo

        async with get_pool().acquire() as conn:
            await repo.insert_request_log(
                conn,
                batch_size=len(request.transactions),
                latency_ms=latency_ms,
                llm_calls=llm_calls,
                cache_hits=cache_hits,
            )
    except Exception as exc:
        logger.error("Failed to write request_log: %s", exc)

    return CategorizeResponse(transactions=categorized)
