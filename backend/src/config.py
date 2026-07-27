from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENV: str = "development"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]
    AZURE_DOCUMENT_INTELLIGENCE_KEY: str = ""
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: str = ""
    DATABASE_URL: str = ""

    # ------------------------------------------------------------------
    # LLM — merchant categorization
    # ------------------------------------------------------------------
    # Provider: "openai" | "azure_openai"
    LLM_PROVIDER: str = "azure_openai"
    # Model name used when LLM_PROVIDER == "openai"
    LLM_MODEL: str = "gpt-4o-mini"
    # API key (both providers)
    LLM_API_KEY: str = ""
    # Azure OpenAI only
    LLM_AZURE_ENDPOINT: str = ""        # e.g. https://xxx.openai.azure.com/
    LLM_AZURE_DEPLOYMENT: str = "gpt-4o-mini"
    LLM_AZURE_API_VERSION: str = "2024-08-01-preview"

    # ------------------------------------------------------------------
    # Categorization thresholds
    # ------------------------------------------------------------------
    # LLM confidence must be >= this to write to merchants dictionary
    LLM_CONFIDENCE_THRESHOLD: float = 0.75
    # pg_trgm similarity must be >= this for a fuzzy match to count
    LLM_FUZZY_THRESHOLD: float = 0.45

    class Config:
        env_file = ".env"
        extra = "ignore"  # silently drop .env vars not declared in Settings


settings = Settings()
