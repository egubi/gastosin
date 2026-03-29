"""
Proprietary merchant categorization — the GastosIn moat.
Backend only. Never expose this logic client-side.

Three-layer taxonomy (CLAUDE.md):
  Layer 1: Base defaults      — ships day one (implemented here)
  Layer 2: Learned mappings   — post-MVP
  Layer 3: Personal overrides — post-MVP

MVP: base defaults only. Exact-match on lowercase merchant name,
     with a fallback to "Other" if no match found.
"""

from src.models import Transaction, CategorizedTransaction

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


def _match_merchant(merchant: str) -> tuple[str, str]:
    """
    Returns (category, subcategory) for a given merchant name.
    Tries substring match on lowercased merchant, falls back to ("Other", None).
    """
    merchant_lower = merchant.lower()
    for keyword, category, subcategory in BASE_MAPPINGS:
        if keyword in merchant_lower:
            return category, subcategory
    return "Other", None


async def categorize_transactions(
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
