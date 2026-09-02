from __future__ import annotations

import ipaddress
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, or_, select

from .config import Settings
from .dependencies import AdminUser, CurrentUser, DbSession, get_app_settings
from .models import Activity, BrowserSession, PlatformSettings, Profile, ProfileVault, Proxy, User
from .schemas import (
    ActivityOut,
    AuthSession,
    LoginInput,
    PasswordChange,
    ProfileInput,
    ProfileOut,
    ProfileStoragePayload,
    ProxyInput,
    ProxyOut,
    SettingsPayload,
    StatsOverview,
    UsagePoint,
    UserCreate,
    UserCreated,
    UserOut,
    UserPatch,
)
from .security import VaultCipher, create_access_token, hash_password, temporary_password, verify_password
from .services import (
    accessible_profile,
    accessible_proxy,
    decrypt_proxy_password,
    get_platform_settings,
    profile_out,
    proxy_out,
    record_activity,
    test_proxy_connectivity,
)


router = APIRouter(prefix="/api")


@router.post("/auth/login", response_model=AuthSession)
def login(
    payload: LoginInput,
    db: DbSession,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> AuthSession:
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        # verify_password executes a dummy Argon2 check for unknown accounts.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Esta cuenta está suspendida")

    user.last_login_at = datetime.now(timezone.utc)
    record_activity(db, user, "auth.login", user.email, "Inicio de sesión correcto")
    db.commit()
    return AuthSession(
        token=create_access_token(user.id, user.role, user.auth_version, settings),
        user=UserOut.model_validate(user),
    )


@router.get("/auth/me", response_model=UserOut)
def me(current_user: CurrentUser) -> User:
    return current_user


@router.post("/auth/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChange, db: DbSession, current_user: CurrentUser) -> Response:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual no es correcta")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La nueva contraseña debe ser diferente")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.auth_version += 1
    record_activity(db, current_user, "auth.password", current_user.email, "Contraseña actualizada")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/profiles", response_model=list[ProfileOut])
def list_profiles(db: DbSession, current_user: CurrentUser) -> list[ProfileOut]:
    query = select(Profile).order_by(Profile.created_at.desc())
    if current_user.role != "admin":
        query = query.where(Profile.owner_id == current_user.id)
    return [profile_out(db, item) for item in db.scalars(query).all()]


def _network_for_profile(
    db: DbSession,
    current_user: User,
    payload: ProfileInput,
    settings_row: PlatformSettings,
) -> tuple[str | None, str]:
    if payload.use_default_ip:
        return None, settings_row.default_server_ip
    proxy = accessible_proxy(db, payload.proxy_id or "", current_user)
    return proxy.id, proxy.detected_ip or "sin resolver"


@router.post("/profiles", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    payload: ProfileInput,
    db: DbSession,
    current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ProfileOut:
    platform = get_platform_settings(db, settings)
    proxy_id, effective_ip = _network_for_profile(db, current_user, payload, platform)
    should_start = platform.auto_start_on_create
    if proxy_id:
        proxy = db.get(Proxy, proxy_id)
        should_start = should_start and bool(proxy and proxy.healthy and proxy.detected_ip)

    profile = Profile(
        owner_id=current_user.id,
        name=payload.name.strip(),
        status="running" if should_start else "stopped",
        os=payload.os,
        timezone=payload.timezone,
        locale=payload.locale,
        use_default_ip=payload.use_default_ip,
        proxy_id=proxy_id,
        effective_ip=effective_ip,
    )
    db.add(profile)
    db.flush()
    cipher = VaultCipher(settings)
    db.add(ProfileVault(profile_id=profile.id, encrypted_payload=cipher.encrypt_json({"cookies": [], "local_storage": {}})))
    if should_start:
        profile.last_session_at = datetime.now(timezone.utc)
        db.add(BrowserSession(profile_id=profile.id, started_at=profile.last_session_at))
    record_activity(
        db,
        current_user,
        "profile.create",
        profile.name,
        f"Bóveda aislada creada · salida {effective_ip}",
    )
    db.commit()
    db.refresh(profile)
    return profile_out(db, profile)


@router.patch("/profiles/{profile_id}", response_model=ProfileOut)
def update_profile(
    profile_id: str,
    payload: ProfileInput,
    db: DbSession,
    current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ProfileOut:
    profile = accessible_profile(db, profile_id, current_user)
    platform = get_platform_settings(db, settings)
    proxy_id, effective_ip = _network_for_profile(db, current_user, payload, platform)
    profile.name = payload.name.strip()
    profile.os = payload.os
    profile.timezone = payload.timezone
    profile.locale = payload.locale
    profile.use_default_ip = payload.use_default_ip
    profile.proxy_id = proxy_id
    profile.effective_ip = effective_ip
    record_activity(db, current_user, "profile.update", profile.name, "Red y preferencias actualizadas")
    db.commit()
    return profile_out(db, profile)


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: str, db: DbSession, current_user: CurrentUser) -> Response:
    profile = accessible_profile(db, profile_id, current_user)
    name = profile.name
    db.delete(profile)
    record_activity(
        db,
        current_user,
        "profile.delete",
        name,
        "Perfil, cookies y datos aislados eliminados",
        "warn",
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/profiles/{profile_id}/start", response_model=ProfileOut)
def start_profile(
    profile_id: str,
    db: DbSession,
    current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ProfileOut:
    profile = accessible_profile(db, profile_id, current_user)
    if profile.status == "running":
        return profile_out(db, profile)
    platform = get_platform_settings(db, settings)
    running = db.scalar(select(func.count(Profile.id)).where(Profile.status == "running")) or 0
    if running >= platform.max_concurrent_profiles:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Se alcanzó el límite de perfiles concurrentes")
    if profile.proxy_id:
        proxy = accessible_proxy(db, profile.proxy_id, current_user)
        if not proxy.healthy or not proxy.detected_ip:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Prueba el proxy asignado antes de iniciar")
        profile.effective_ip = proxy.detected_ip
    else:
        profile.effective_ip = platform.default_server_ip

    profile.status = "running"
    profile.last_session_at = datetime.now(timezone.utc)
    db.add(BrowserSession(profile_id=profile.id, started_at=profile.last_session_at))
    record_activity(db, current_user, "profile.start", profile.name, f"Sesión aislada iniciada en {profile.effective_ip}")
    db.commit()
    return profile_out(db, profile)


@router.post("/profiles/{profile_id}/stop", response_model=ProfileOut)
def stop_profile(profile_id: str, db: DbSession, current_user: CurrentUser) -> ProfileOut:
    profile = accessible_profile(db, profile_id, current_user)
    profile.status = "paused"
    active_session = db.scalar(
        select(BrowserSession)
        .where(BrowserSession.profile_id == profile.id, BrowserSession.ended_at.is_(None))
        .order_by(BrowserSession.started_at.desc())
    )
    if active_session:
        active_session.ended_at = datetime.now(timezone.utc)
    record_activity(db, current_user, "profile.stop", profile.name, "Sesión aislada pausada", "warn")
    db.commit()
    return profile_out(db, profile)


@router.get("/profiles/{profile_id}/storage", response_model=ProfileStoragePayload)
def get_profile_storage(
    profile_id: str,
    response: Response,
    db: DbSession,
    current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ProfileStoragePayload:
    profile = accessible_profile(db, profile_id, current_user)
    response.headers["Cache-Control"] = "no-store"
    if profile.vault is None:
        return ProfileStoragePayload()
    return ProfileStoragePayload.model_validate(VaultCipher(settings).decrypt_json(profile.vault.encrypted_payload))


@router.put("/profiles/{profile_id}/storage", response_model=ProfileStoragePayload)
def put_profile_storage(
    profile_id: str,
    payload: ProfileStoragePayload,
    response: Response,
    db: DbSession,
    current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ProfileStoragePayload:
    profile = accessible_profile(db, profile_id, current_user)
    encrypted = VaultCipher(settings).encrypt_json(payload.model_dump(mode="json"))
    if profile.vault is None:
        db.add(ProfileVault(profile_id=profile.id, encrypted_payload=encrypted))
    else:
        profile.vault.encrypted_payload = encrypted
        profile.vault.version += 1
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return payload


@router.delete("/profiles/{profile_id}/storage", status_code=status.HTTP_204_NO_CONTENT)
def clear_profile_storage(
    profile_id: str,
    db: DbSession,
    current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> Response:
    profile = accessible_profile(db, profile_id, current_user)
    encrypted = VaultCipher(settings).encrypt_json({"cookies": [], "local_storage": {}})
    if profile.vault is None:
        db.add(ProfileVault(profile_id=profile.id, encrypted_payload=encrypted))
    else:
        profile.vault.encrypted_payload = encrypted
        profile.vault.version += 1
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/proxies", response_model=list[ProxyOut])
def list_proxies(db: DbSession, current_user: CurrentUser) -> list[ProxyOut]:
    query = select(Proxy).order_by(Proxy.created_at.desc())
    if current_user.role != "admin":
        query = query.where(Proxy.owner_id == current_user.id)
    return [proxy_out(db, item) for item in db.scalars(query).all()]


@router.post("/proxies", response_model=ProxyOut, status_code=status.HTTP_201_CREATED)
def create_proxy(
    payload: ProxyInput,
    db: DbSession,
    current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ProxyOut:
    cipher = VaultCipher(settings)
    proxy = Proxy(
        owner_id=current_user.id,
        label=payload.label.strip(),
        type=payload.type,
        host=payload.host,
        port=payload.port,
        username=payload.username,
        encrypted_password=(cipher.encrypt_json({"password": payload.password}) if payload.password else None),
        country=payload.country.upper(),
    )
    db.add(proxy)
    db.commit()
    db.refresh(proxy)
    return proxy_out(db, proxy)


@router.delete("/proxies/{proxy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_proxy(proxy_id: str, db: DbSession, current_user: CurrentUser) -> Response:
    proxy = accessible_proxy(db, proxy_id, current_user)
    in_use = db.scalar(select(func.count(Profile.id)).where(Profile.proxy_id == proxy.id)) or 0
    if in_use:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El proxy está asignado a uno o más perfiles")
    db.delete(proxy)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/proxies/{proxy_id}/test", response_model=ProxyOut)
async def test_proxy(
    proxy_id: str,
    db: DbSession,
    current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ProxyOut:
    proxy = accessible_proxy(db, proxy_id, current_user)
    try:
        latency, detected_ip = await test_proxy_connectivity(
            proxy, decrypt_proxy_password(proxy, VaultCipher(settings)), settings
        )
        proxy.latency_ms = latency
        proxy.detected_ip = detected_ip
        proxy.healthy = True
        detail = f"{latency} ms · {detected_ip or 'IP no detectada'}"
        level = "info"
    except Exception:
        proxy.latency_ms = None
        proxy.detected_ip = None
        proxy.healthy = False
        detail = "El nodo no superó la prueba de conectividad segura"
        level = "error"
    proxy.last_tested_at = datetime.now(timezone.utc)
    record_activity(db, current_user, "proxy.test", proxy.label, detail, level)
    db.commit()
    return proxy_out(db, proxy)


@router.get("/activity", response_model=list[ActivityOut])
def list_activity(db: DbSession, current_user: CurrentUser) -> list[Activity]:
    query = select(Activity).order_by(Activity.at.desc()).limit(500)
    if current_user.role != "admin":
        query = query.where(Activity.actor_id == current_user.id)
    return list(db.scalars(query).all())


@router.get("/users", response_model=list[UserOut])
def list_users(db: DbSession, _admin: AdminUser) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())


@router.post("/users", response_model=UserCreated, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: DbSession, admin: AdminUser) -> UserCreated:
    exists = db.scalar(select(User.id).where(func.lower(User.email) == payload.email.lower()))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un usuario con ese correo")
    clear_password = payload.password or temporary_password()
    user = User(
        email=payload.email.lower(),
        name=payload.name.strip(),
        role=payload.role,
        password_hash=hash_password(clear_password),
    )
    db.add(user)
    record_activity(db, admin, "settings.update", user.email, "Cuenta de usuario creada")
    db.commit()
    db.refresh(user)
    return UserCreated(**UserOut.model_validate(user).model_dump(), temporary_password=clear_password)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserPatch, db: DbSession, admin: AdminUser) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    if user.id == admin.id and payload.status == "suspended":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No puedes suspender tu propia cuenta")
    if user.role == "admin" and (payload.role == "user" or payload.status == "suspended"):
        active_admins = db.scalar(
            select(func.count(User.id)).where(User.role == "admin", User.status == "active")
        ) or 0
        if active_admins <= 1:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Debe quedar al menos un administrador activo")
    if payload.role is not None:
        user.role = payload.role
    if payload.status is not None:
        user.status = payload.status
    record_activity(db, admin, "settings.update", user.email, "Rol o estado de cuenta actualizado")
    db.commit()
    return user


@router.get("/settings", response_model=SettingsPayload)
def get_settings_endpoint(
    db: DbSession,
    _current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> PlatformSettings:
    return get_platform_settings(db, settings)


@router.put("/settings", response_model=SettingsPayload)
def update_settings(
    payload: SettingsPayload,
    db: DbSession,
    admin: AdminUser,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> PlatformSettings:
    try:
        ipaddress.ip_address(payload.default_server_ip)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="La IP del servidor no es válida") from exc
    row = get_platform_settings(db, settings)
    previous_ip = row.default_server_ip
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    if previous_ip != row.default_server_ip:
        profiles = db.scalars(select(Profile).where(Profile.use_default_ip.is_(True))).all()
        for profile in profiles:
            profile.effective_ip = row.default_server_ip
    record_activity(db, admin, "settings.update", "Ajustes globales", "Configuración de plataforma actualizada")
    db.commit()
    return row


@router.get("/stats/overview", response_model=StatsOverview)
def stats_overview(db: DbSession, current_user: CurrentUser) -> StatsOverview:
    profile_filter = Profile.owner_id == current_user.id
    proxy_filter = Proxy.owner_id == current_user.id
    profiles_query = select(Profile)
    proxies_query = select(Proxy)
    if current_user.role != "admin":
        profiles_query = profiles_query.where(profile_filter)
        proxies_query = proxies_query.where(proxy_filter)
    profiles = list(db.scalars(profiles_query).all())
    proxies = list(db.scalars(proxies_query).all())

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=6)
    session_query = select(BrowserSession).join(Profile).where(BrowserSession.started_at >= week_start)
    if current_user.role != "admin":
        session_query = session_query.where(profile_filter)
    sessions = db.scalars(session_query).all()
    by_day: dict[str, list[BrowserSession]] = defaultdict(list)
    for item in sessions:
        by_day[item.started_at.date().isoformat()].append(item)
    now = datetime.now(timezone.utc)
    usage: list[UsagePoint] = []
    for offset in range(7):
        day = (week_start + timedelta(days=offset)).date().isoformat()
        items = by_day[day]
        minutes = sum(
            max(1, round(((item.ended_at or now) - item.started_at).total_seconds() / 60))
            for item in items
        )
        usage.append(UsagePoint(date=day, sessions=len(items), minutes=minutes))

    return StatsOverview(
        profiles_total=len(profiles),
        profiles_running=sum(item.status == "running" for item in profiles),
        profiles_paused=sum(item.status == "paused" for item in profiles),
        sessions_today=sum(item.started_at >= today for item in sessions),
        proxies_healthy=sum(item.healthy for item in proxies),
        proxies_total=len(proxies),
        usage=usage,
    )
