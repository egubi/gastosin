"""
llm_client.py — Thin LLM wrapper for merchant categorization.

Sends a structured prompt asking the model to choose from the closed
category list passed in.  Returns {"category_key": str, "confidence": float}.

The model MUST choose a key from the provided list or return "unknown";
it may not invent new categories.

Supports OpenAI and Azure OpenAI via the `openai` Python library.
Provider + credentials come from Settings so they are centrally configured
and never hardcoded.
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.config import Settings

logger = logging.getLogger("gastosin.llm")

_SYSTEM_PROMPT = """\
You are a merchant categorizer for Philippine credit card statements.
Given a normalized merchant name, classify it into exactly one category
from the provided list.

Rules:
- Choose the most specific category that applies.
- If no category clearly fits, use "unknown".
- Do NOT invent categories that are not in the provided list.
- confidence: 1.0 = certain match, 0.5 = educated guess, 0.0 = no idea.

Respond with ONLY valid JSON, no extra text:
{"category_key": "<exact_key_from_list_or_unknown>", "confidence": <0.0-1.0>}\
"""


def _build_user_prompt(normalized_name: str, categories: list[dict]) -> str:
    lines = "\n".join(f"- {c['key']}: {c['label']}" for c in categories)
    return (
        f"Merchant: {normalized_name}\n\n"
        f"Available categories (use the exact key):\n{lines}"
    )


class LLMClient:
    """
    Wraps AsyncOpenAI / AsyncAzureOpenAI for structured merchant
    categorization.  Provider is selected via settings.LLM_PROVIDER.
    """

    def __init__(self, settings: "Settings") -> None:
        self._settings = settings
        self._client = self._build_client(settings)

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    async def categorize(
        self, normalized_name: str, categories: list[dict]
    ) -> dict:
        """
        Returns {"category_key": str, "confidence": float}.

        category_key is always one of the provided keys or "unknown".
        On any error (network, parsing, unexpected key) falls back to
        {"category_key": "unknown", "confidence": 0.0}.
        """
        valid_keys = {c["key"] for c in categories} | {"unknown"}
        model = (
            self._settings.LLM_AZURE_DEPLOYMENT
            if self._settings.LLM_PROVIDER == "azure_openai"
            else self._settings.LLM_MODEL
        )

        try:
            response = await self._client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": _build_user_prompt(normalized_name, categories),
                    },
                ],
                # No response_format or max_completion_tokens — gpt-5-mini is a
                # reasoning model; those constraints truncate its thinking budget.
                # The system prompt enforces JSON output instead.
            )
            raw = response.choices[0].message.content or "{}"
            data = json.loads(raw)
        except Exception as exc:
            logger.warning(
                "LLM call failed for %r: %s", normalized_name, exc
            )
            return {"category_key": "unknown", "confidence": 0.0}

        category_key = str(data.get("category_key", "unknown"))
        if category_key not in valid_keys:
            logger.warning(
                "LLM returned unrecognised key %r for %r; treating as unknown",
                category_key,
                normalized_name,
            )
            category_key = "unknown"

        confidence = float(data.get("confidence", 0.0))
        confidence = max(0.0, min(1.0, confidence))

        return {"category_key": category_key, "confidence": confidence}

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _build_client(settings: "Settings"):
        try:
            import openai
        except ImportError as exc:
            raise ImportError(
                "openai package is required for LLM categorization. "
                "Add it to requirements.txt and reinstall."
            ) from exc

        if settings.LLM_PROVIDER == "azure_openai":
            return openai.AsyncAzureOpenAI(
                api_key=settings.LLM_API_KEY,
                azure_endpoint=settings.LLM_AZURE_ENDPOINT,
                api_version=settings.LLM_AZURE_API_VERSION,
            )

        return openai.AsyncOpenAI(api_key=settings.LLM_API_KEY)
