from __future__ import annotations

import base64
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from cryptography.fernet import Fernet, InvalidToken
from pwdlib import PasswordHash

from .config import Settings


password_hash = PasswordHash.recommended()
_DUMMY_HASH = password_hash.hash("not-a-real-account-password")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded: str | None) -> bool:
    try:
        return password_hash.verify(password, encoded or _DUMMY_HASH)
    except Exception:
        return False


def create_access_token(user_id: str, role: str, auth_version: int, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "ver": auth_version,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
        "jti": secrets.token_urlsafe(16),
        "iss": "novashield",
        "aud": "novashield-web",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        audience="novashield-web",
        issuer="novashield",
        options={"require": ["sub", "role", "ver", "iat", "exp", "jti"]},
    )


def temporary_password() -> str:
    return secrets.token_urlsafe(18)


class VaultCipher:
    def __init__(self, settings: Settings) -> None:
        if settings.profile_data_key:
            raw = hashlib.sha256(settings.profile_data_key.encode("utf-8")).digest()
        else:
            raw = hashlib.sha256(
                f"novashield-profile-vault:{settings.jwt_secret}".encode("utf-8")
            ).digest()
        self._fernet = Fernet(base64.urlsafe_b64encode(raw))

    def encrypt_json(self, payload: dict[str, Any]) -> bytes:
        packed = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        return self._fernet.encrypt(packed)

    def decrypt_json(self, encrypted: bytes) -> dict[str, Any]:
        try:
            return json.loads(self._fernet.decrypt(encrypted).decode("utf-8"))
        except (InvalidToken, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("No se pudo descifrar la bóveda del perfil") from exc
