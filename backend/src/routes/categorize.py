from fastapi import APIRouter
from src.models import CategorizeRequest, CategorizeResponse
from src.services.categorizer import categorize_transactions

router = APIRouter()


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize(request: CategorizeRequest):
    """
    Accepts sanitized { date, merchant, amount } only.
    Returns the same list with category + subcategory appended.
    """
    categorized = await categorize_transactions(request.transactions)
    return CategorizeResponse(transactions=categorized)
