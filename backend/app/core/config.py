from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "POS Business Management"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/pos_db"
    
    # Security / JWT
    JWT_SECRET_KEY: str = "change_this_to_a_very_secure_secret_key_at_least_32_chars_long"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Cookie settings
    COOKIE_SECURE: bool = False  # False for local HTTP
    COOKIE_SAMESITE: str = "lax"
    
    # First Owner Setup (Auto-seeded if no user exists)
    FIRST_OWNER_USERNAME: str = "owner"
    FIRST_OWNER_PASSWORD: str = "owner123"
    FIRST_OWNER_FULL_NAME: str = "Store Owner"
    FIRST_STORE_NAME: str = "Main Solar Store"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
