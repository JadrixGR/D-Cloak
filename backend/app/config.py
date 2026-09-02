from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "NovaShield API"
    environment: str = "development"
    database_url: str = "sqlite:///./novashield.db"
    jwt_secret: str = "development-only-change-this-secret"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    profile_data_key: str | None = None
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    default_server_ip: str = "127.0.0.1"
    admin_email: str = "admin@novashield.app"
    admin_name: str = "Nova Admin"
    admin_initial_password: str | None = None
    allow_private_proxies: bool = False
    proxy_test_url: str = "https://api.ipify.org?format=json"
    browser_provider: Literal["disabled", "browserbase", "memory"] = "disabled"
    browserbase_api_key: str | None = None
    browserbase_project_id: str | None = None
    browserbase_api_url: str = "https://api.browserbase.com/v1"
    browserbase_region: Literal["us-west-2", "us-east-1", "eu-central-1", "ap-southeast-1"] = "us-east-1"
    browser_session_timeout_seconds: int = 3600
    auto_create_schema: bool = True

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Render still exposes postgres:// URLs in a few integration paths.
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://") and "+" not in value.split("://", 1)[0]:
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.environment.lower() == "production" and len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET debe tener al menos 32 caracteres en producción")
        if self.environment.lower() == "production" and self.browser_provider == "memory":
            raise ValueError("BROWSER_PROVIDER=memory no está permitido en producción")
        if not 60 <= self.browser_session_timeout_seconds <= 21600:
            raise ValueError("BROWSER_SESSION_TIMEOUT_SECONDS debe estar entre 60 y 21600")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
