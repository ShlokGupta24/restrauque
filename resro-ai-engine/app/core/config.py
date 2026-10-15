import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    APP_NAME: str = "Resro AI Engine"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    MURIL_MODEL_NAME: str = os.getenv(
        "MURIL_MODEL_NAME",
        "airzipm/sentiment-analysis-muril-v2",
    )

    AI_SERVICE_TOKEN: str = os.getenv("AI_SERVICE_TOKEN", "")

    def validate_database_url(self) -> None:
        if not self.DATABASE_URL:
            raise ValueError(
                "DATABASE_URL is missing. "
                "Configure it in your local .env file."
            )


settings = Settings()
