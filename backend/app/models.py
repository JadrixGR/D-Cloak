from __future__ import annotations

import secrets
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(9)}"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("u"))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(16), default="user", index=True)
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    auth_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    profiles: Mapped[list["Profile"]] = relationship(back_populates="owner")
    proxies: Mapped[list["Proxy"]] = relationship(back_populates="owner")


class Proxy(Base):
    __tablename__ = "proxies"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("px"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(16))
    host: Mapped[str] = mapped_column(String(255))
    port: Mapped[int] = mapped_column(Integer)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    encrypted_password: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    country: Mapped[str] = mapped_column(String(2), default="PE")
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detected_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    healthy: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped[User] = relationship(back_populates="proxies")
    profiles: Mapped[list["Profile"]] = relationship(back_populates="proxy")


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("pf"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    proxy_id: Mapped[str | None] = mapped_column(ForeignKey("proxies.id", ondelete="RESTRICT"), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(16), default="stopped", index=True)
    os: Mapped[str] = mapped_column(String(32))
    fingerprint: Mapped[str] = mapped_column(String(160), default="Chromium · almacenamiento aislado")
    timezone: Mapped[str] = mapped_column(String(64))
    locale: Mapped[str] = mapped_column(String(16))
    use_default_ip: Mapped[bool] = mapped_column(Boolean, default=True)
    effective_ip: Mapped[str] = mapped_column(String(64))
    storage_namespace: Mapped[str] = mapped_column(String(80), unique=True, default=lambda: new_id("vault"))
    last_session_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped[User] = relationship(back_populates="profiles")
    proxy: Mapped[Proxy | None] = relationship(back_populates="profiles")
    vault: Mapped["ProfileVault | None"] = relationship(
        back_populates="profile", cascade="all, delete-orphan", uselist=False
    )
    sessions: Mapped[list["BrowserSession"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )


class ProfileVault(Base):
    __tablename__ = "profile_vaults"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("pv"))
    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), unique=True, index=True
    )
    encrypted_payload: Mapped[bytes] = mapped_column(LargeBinary)
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    profile: Mapped[Profile] = relationship(back_populates="vault")


class BrowserSession(Base):
    __tablename__ = "browser_sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("ss"))
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    profile: Mapped[Profile] = relationship(back_populates="sessions")


class Activity(Base):
    __tablename__ = "activity"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("ac"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    actor_name: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(String(40), index=True)
    target: Mapped[str] = mapped_column(String(160))
    detail: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(16), default="info")
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class PlatformSettings(Base):
    __tablename__ = "platform_settings"
    __table_args__ = (UniqueConstraint("singleton_key", name="uq_platform_settings_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    singleton_key: Mapped[str] = mapped_column(String(16), default="global")
    default_server_ip: Mapped[str] = mapped_column(String(64))
    default_timezone: Mapped[str] = mapped_column(String(64), default="America/Lima")
    default_locale: Mapped[str] = mapped_column(String(16), default="es-PE")
    auto_start_on_create: Mapped[bool] = mapped_column(Boolean, default=False)
    max_concurrent_profiles: Mapped[int] = mapped_column(Integer, default=12)
    webrtc_protection: Mapped[bool] = mapped_column(Boolean, default=True)
