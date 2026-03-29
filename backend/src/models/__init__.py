from pydantic import BaseModel, Field
from typing import Optional


class Transaction(BaseModel):
    """
    Sanitized transaction — the ONLY shape the API accepts.
    No PII. No card numbers. No names. Just these three fields.
    """
    date: str = Field(..., description="ISO8601 date e.g. 2024-01-15")
    merchant: str = Field(..., description="Merchant name from statement")
    amount: float = Field(..., description="Transaction amount in PHP")


class CategorizedTransaction(Transaction):
    category: str
    subcategory: Optional[str] = None


class CategorizeRequest(BaseModel):
    transactions: list[Transaction]


class CategorizeResponse(BaseModel):
    transactions: list[CategorizedTransaction]
