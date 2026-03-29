from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.routes import categorize, health
from src.config import settings

app = FastAPI(
    title="GastosIn API",
    description="Proprietary categorization backend — not open source",
    version="0.1.0",
    # Disable docs in production
    docs_url="/docs" if settings.ENV == "development" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(categorize.router, prefix="/api")
