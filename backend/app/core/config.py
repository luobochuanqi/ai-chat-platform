from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # App
    APP_NAME: str = "AI Chat Platform"
    DEBUG: bool = False
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = "sqlite:///./data/app.db"
    
    # DeepSeek API
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_API_BASE: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL: str = "deepseek-chat"  # flash model
    
    # Seedream API
    SEEDREAM_API_KEY: str = ""
    SEEDREAM_API_BASE: str = ""
    
    # Quota defaults
    DEFAULT_CHAT_QUOTA: int = 200
    DEFAULT_IMAGE_QUOTA: int = 50
    
    # File storage
    UPLOAD_DIR: str = "./data/images"
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
