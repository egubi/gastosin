from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENV: str = "development"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]
    AZURE_DOCUMENT_INTELLIGENCE_KEY: str = ""
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
