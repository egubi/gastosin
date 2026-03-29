"""
Azure Document Intelligence client — OCR fallback only.

Called when client-side pdf.js parsing yields low confidence.
IMPORTANT: Only sanitized bounding box regions are transmitted.
           The full PDF never leaves the browser.

TODO: Implement when frontend signals OCR fallback is needed.
"""

async def extract_regions(sanitized_regions: list[dict]) -> list[dict]:
    raise NotImplementedError("Azure fallback not yet implemented")
