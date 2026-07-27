import logging

import asyncpg
from src.config import settings

logger = logging.getLogger("gastosin.db")

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    logger.info("Connecting to Postgres...")
    try:
        _pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=1,
            max_size=10,
        )
        version: str = await _pool.fetchval("SELECT version()")
        logger.info("Postgres reachable — %s", version)
    except Exception as exc:
        logger.error("Postgres connection FAILED: %s", exc)
        raise


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool is not initialised")
    return _pool
