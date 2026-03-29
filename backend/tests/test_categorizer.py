import pytest
from src.services.categorizer import categorize_transactions
from src.models import Transaction


@pytest.mark.asyncio
async def test_known_merchant_categorized():
    txns = [Transaction(date="2024-01-15", merchant="Jollibee SM North", amount=250.0)]
    result = await categorize_transactions(txns)
    assert result[0].category == "Food & Dining"
    assert result[0].subcategory == "Fast Food"


@pytest.mark.asyncio
async def test_unknown_merchant_falls_back_to_other():
    txns = [Transaction(date="2024-01-15", merchant="Random Store XYZ", amount=100.0)]
    result = await categorize_transactions(txns)
    assert result[0].category == "Other"


@pytest.mark.asyncio
async def test_sanitized_fields_only_in_response():
    txns = [Transaction(date="2024-01-15", merchant="Starbucks BGC", amount=320.0)]
    result = await categorize_transactions(txns)
    txn = result[0]
    # Confirm no PII fields exist on the model
    assert not hasattr(txn, "card_number")
    assert not hasattr(txn, "account_id")
    assert not hasattr(txn, "name")
