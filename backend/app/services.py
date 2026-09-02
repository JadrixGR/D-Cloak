from __future__ import annotations

import asyncio
import ipaddress
import socket
import time
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import Settings
from .models import Activity, BrowserSession, PlatformSettings, Profile, Proxy, User
from .schemas import ProfileOut, ProxyOut
from .security import VaultCipher


def get_platform_settings(db: Session, config: Settings) -> PlatformSettings:
    row = db.scalar(select(PlatformSettings).where(PlatformSettings.singleton_key == "global"))
    if row is None:
        row = PlatformSettings(default_server_ip=config.default_server_ip)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def record_activity(
    db: Session,
    actor: User,
    action: str,
    target: str,
    detail: str,
    level: str = "info",
) -> None:
    db.add(
        Activity(
            actor_id=actor.id,
            actor_name=actor.name,
            action=action,
            target=target,
            detail=detail,
            level=level,
        )
    )


def accessible_profile(db: Session, profile_id: str, actor: User) -> Profile:
    profile = db.get(Profile, profile_id)
    if profile is None or (actor.role != "admin" and profile.owner_id != actor.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado")
    return profile


def accessible_profile_for_update(db: Session, profile_id: str, actor: User) -> Profile:
    profile = db.scalar(select(Profile).where(Profile.id == profile_id).with_for_update())
    if profile is None or (actor.role != "admin" and profile.owner_id != actor.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado")
    return profile


def accessible_proxy(db: Session, proxy_id: str, actor: User) -> Proxy:
    proxy = db.get(Proxy, proxy_id)
    if proxy is None or (actor.role != "admin" and proxy.owner_id != actor.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proxy no encontrado")
    return proxy


def proxy_out(db: Session, proxy: Proxy) -> ProxyOut:
    profiles_count = db.scalar(select(func.count(Profile.id)).where(Profile.proxy_id == proxy.id)) or 0
    return ProxyOut(
        id=proxy.id,
        label=proxy.label,
        type=proxy.type,
        host=proxy.host,
        port=proxy.port,
        username=proxy.username,
        country=proxy.country,
        latency_ms=proxy.latency_ms,
        detected_ip=proxy.detected_ip,
        last_tested_at=proxy.last_tested_at,
        healthy=proxy.healthy,
        profiles_count=profiles_count,
    )


def profile_out(db: Session, profile: Profile) -> ProfileOut:
    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    sessions_today = db.scalar(
        select(func.count(BrowserSession.id)).where(
            BrowserSession.profile_id == profile.id,
            BrowserSession.started_at >= start_of_day,
        )
    ) or 0
    return ProfileOut(
        id=profile.id,
        name=profile.name,
        status=profile.status,
        os=profile.os,
        fingerprint=profile.fingerprint,
        timezone=profile.timezone,
        locale=profile.locale,
        use_default_ip=profile.use_default_ip,
        proxy_id=profile.proxy_id,
        effective_ip=profile.effective_ip,
        owner_id=profile.owner_id,
        owner_name=profile.owner.name,
        last_session_at=profile.last_session_at,
        sessions_today=sessions_today,
        created_at=profile.created_at,
    )


async def _resolved_ips(host: str, port: int) -> set[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError("El host del proxy no se pudo resolver") from exc
    return {ipaddress.ip_address(info[4][0]) for info in infos}


async def test_proxy_connectivity(
    proxy: Proxy,
    password: str | None,
    settings: Settings,
) -> tuple[int, str | None]:
    resolved = await _resolved_ips(proxy.host, proxy.port)
    if not resolved:
        raise ValueError("El host del proxy no devolvió direcciones")
    if not settings.allow_private_proxies and any(not ip.is_global for ip in resolved):
        raise ValueError("Por seguridad, no se permiten proxies en redes privadas o reservadas")

    started = time.perf_counter()
    if proxy.type == "ssh":
        _reader, writer = await asyncio.wait_for(
            asyncio.open_connection(proxy.host, proxy.port), timeout=8
        )
        writer.close()
        await writer.wait_closed()
        latency = round((time.perf_counter() - started) * 1000)
        return latency, str(next(iter(resolved)))

    scheme = "socks5" if proxy.type == "socks5" else "http"
    auth = ""
    if proxy.username:
        auth = quote(proxy.username, safe="")
        if password:
            auth += f":{quote(password, safe='')}"
        auth += "@"
    proxy_url = f"{scheme}://{auth}{proxy.host}:{proxy.port}"
    async with httpx.AsyncClient(proxy=proxy_url, timeout=10, trust_env=False) as client:
        response = await client.get(settings.proxy_test_url)
        response.raise_for_status()
        detected = response.json().get("ip")
    latency = round((time.perf_counter() - started) * 1000)
    if detected:
        ipaddress.ip_address(detected)
    return latency, detected


def decrypt_proxy_password(proxy: Proxy, cipher: VaultCipher) -> str | None:
    if not proxy.encrypted_password:
        return None
    payload = cipher.decrypt_json(proxy.encrypted_password)
    value = payload.get("password")
    return value if isinstance(value, str) else None
