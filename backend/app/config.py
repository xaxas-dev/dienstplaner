from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Dienstplaner"
    version: str = "0.1.0"
    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'dienstplaner.db').as_posix()}"


settings = Settings()
