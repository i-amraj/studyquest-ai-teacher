from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "StudyQuest AI Teacher"
    secret_key: str = "dev-only-change-me"
    database_url: str = "sqlite:///./studyquest_dev.db"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_model_pro: str = "gemini-3.1-pro-preview"
    access_token_minutes: int = 30
    refresh_token_days: int = 7
    max_upload_mb: int = 25
    ai_daily_budget_per_user: int = 50
    algorithm: str = "HS256"
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
