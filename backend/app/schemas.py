from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


Role = Literal["admin", "user"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    name: str
    role: Role
    status: Literal["active", "suspended"]
    created_at: datetime
    last_login_at: datetime | None


class UserCreated(UserOut):
    temporary_password: str


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    role: Role = "user"
    password: str | None = Field(default=None, min_length=12, max_length=128)


class UserPatch(BaseModel):
    role: Role | None = None
    status: Literal["active", "suspended"] | None = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthSession(BaseModel):
    token: str
    user: UserOut


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class ProxyInput(BaseModel):
    label: str = Field(min_length=2, max_length=120)
    type: Literal["http", "socks5", "ssh"]
    host: str = Field(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9._:-]+$")
    port: int = Field(ge=1, le=65535)
    username: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, max_length=512)
    country: str = Field(min_length=2, max_length=2)

    @field_validator("host")
    @classmethod
    def strip_host_brackets(cls, value: str) -> str:
        return value.strip().strip("[]")


class ProxyOut(BaseModel):
    id: str
    label: str
    type: Literal["http", "socks5", "ssh"]
    host: str
    port: int
    username: str | None
    country: str
    latency_ms: int | None
    detected_ip: str | None
    last_tested_at: datetime | None
    healthy: bool
    profiles_count: int


class ProfileInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    os: Literal["Windows 11", "macOS 14", "Linux", "Android 14"]
    timezone: str = Field(min_length=1, max_length=64)
    locale: str = Field(min_length=2, max_length=16)
    use_default_ip: bool
    proxy_id: str | None = None

    @model_validator(mode="after")
    def validate_network_choice(self) -> "ProfileInput":
        if not self.use_default_ip and not self.proxy_id:
            raise ValueError("Debes seleccionar un proxy cuando no usas la IP del servidor")
        if self.use_default_ip:
            self.proxy_id = None
        return self


class ProfileOut(BaseModel):
    id: str
    name: str
    status: Literal["running", "paused", "stopped", "error"]
    os: Literal["Windows 11", "macOS 14", "Linux", "Android 14"]
    fingerprint: str
    timezone: str
    locale: str
    use_default_ip: bool
    proxy_id: str | None
    effective_ip: str
    owner_id: str
    owner_name: str
    last_session_at: datetime | None
    sessions_today: int
    created_at: datetime


class BrowserCookie(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    value: str = Field(max_length=8192)
    domain: str = Field(min_length=1, max_length=255)
    path: str = Field(default="/", max_length=1024)
    expires: float | None = None
    http_only: bool = False
    secure: bool = True
    same_site: Literal["Strict", "Lax", "None"] = "Lax"


class ProfileStoragePayload(BaseModel):
    cookies: list[BrowserCookie] = Field(default_factory=list, max_length=500)
    local_storage: dict[str, dict[str, str]] = Field(default_factory=dict)

    @field_validator("local_storage")
    @classmethod
    def limit_local_storage(cls, value: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
        serialized_size = sum(
            len(origin) + sum(len(key) + len(item) for key, item in values.items())
            for origin, values in value.items()
        )
        if len(value) > 100 or serialized_size > 1_000_000:
            raise ValueError("El almacenamiento del perfil excede el límite permitido")
        return value


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    at: datetime
    actor_name: str
    action: str
    target: str
    detail: str
    level: Literal["info", "warn", "error"]


class UsagePoint(BaseModel):
    date: str
    sessions: int
    minutes: int


class StatsOverview(BaseModel):
    profiles_total: int
    profiles_running: int
    profiles_paused: int
    sessions_today: int
    proxies_healthy: int
    proxies_total: int
    usage: list[UsagePoint]


class SettingsPayload(BaseModel):
    default_server_ip: str = Field(min_length=1, max_length=64)
    default_timezone: str = Field(min_length=1, max_length=64)
    default_locale: str = Field(min_length=2, max_length=16)
    auto_start_on_create: bool
    max_concurrent_profiles: int = Field(ge=1, le=500)
    webrtc_protection: bool
