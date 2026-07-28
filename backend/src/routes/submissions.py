import logging
import re
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile, HTTPException, status
from src.config import settings

logger = logging.getLogger("gastosin.routes")
router = APIRouter()


def sanitize_filename(original_name: str) -> str:
    """
    Sanitize filename: lowercase, remove spaces/special chars, keep only alphanum + hyphens.
    
    Example: "BDO Statement March.pdf" -> "bdo-statement-march"
    """
    # Remove extension
    name_without_ext = original_name.rsplit(".", 1)[0] if "." in original_name else original_name
    # Lowercase
    name = name_without_ext.lower()
    # Replace spaces with hyphens
    name = name.replace(" ", "-")
    # Keep only alphanum and hyphens
    name = re.sub(r"[^a-z0-9-]", "", name)
    # Replace multiple consecutive hyphens with single
    name = re.sub(r"-+", "-", name)
    # Strip leading/trailing hyphens
    name = name.strip("-")
    return name


@router.post("/submit-unknown-format")
async def submit_unknown_format(
    file: UploadFile = File(...),
    consent: bool = Form(...)
):
    """
    Receive a PDF file from a user who could not parse their statement.
    
    User must provide explicit consent. File must be PDF.
    
    Returns:
        - success: True if submitted
        - original_filename: User's original filename
        - stored_filename: Generated filename (YYYYMMDD_HHMMSS_{sanitized_name}.pdf)
        - size_bytes: File size in bytes
        - message: User-friendly confirmation
    """
    # Validate consent
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent is required.",
        )

    # Validate file type — must be PDF
    if file.content_type != "application/pdf" and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF.",
        )

    # Generate filename: YYYYMMDD_HHMMSS_{sanitized_original_name}.pdf
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    sanitized_name = sanitize_filename(file.filename)
    generated_filename = f"{timestamp}_{sanitized_name}.pdf"

    # Read file contents to validate it's readable and get size
    contents = await file.read()

    logger.info(
        "Unknown format PDF received: original=%s, generated=%s, size=%d bytes",
        file.filename,
        generated_filename,
        len(contents),
    )

    # Persist file to configured upload directory
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / generated_filename
    dest.write_bytes(contents)

    logger.info("Unknown format PDF saved: %s", dest)

    return {
        "success": True,
        "original_filename": file.filename,
        "stored_filename": generated_filename,
        "size_bytes": len(contents),
        "message": "Thank you for your submission. This helps us improve GastosIn.",
    }
