from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol
from urllib.parse import urlparse

import httpx

from .config import Settings


class RemoteBrowserError(RuntimeError):
    """A safe, user-facing error returned by the remote browser provider."""


@dataclass(frozen=True)
class RemoteProxy:
    scheme: str
    host: str
    port: int
    username: str | None = None
    password: str | None = None


@dataclass(frozen=True)
class RemoteLaunch:
    session_id: str
    live_view_url: str
    expires_at: datetime | None


class RemoteBrowser(Protocol):
    provider: str

    def create_context(self) -> str: ...

    def launch(
        self,
        *,
        context_id: str,
        profile_id: str,
        owner_id: str,
        mobile: bool,
        proxy: RemoteProxy | None,
    ) -> RemoteLaunch: ...

    def live_view(self, session_id: str) -> str: ...

    def close(self, session_id: str) -> None: ...

    def delete_context(self, context_id: str) -> None: ...


class BrowserbaseRemoteBrowser:
    provider = "browserbase"

    def __init__(self, settings: Settings) -> None:
        if not settings.browserbase_api_key or not settings.browserbase_project_id:
            raise RemoteBrowserError(
                "El navegador remoto aún no está configurado. Añade BROWSERBASE_API_KEY y "
                "BROWSERBASE_PROJECT_ID en Render."
            )
        self.api_key = settings.browserbase_api_key
        self.project_id = settings.browserbase_project_id
        self.base_url = settings.browserbase_api_url.rstrip("/")
        self.region = settings.browserbase_region
        self.timeout_seconds = settings.browser_session_timeout_seconds

    @property
    def _headers(self) -> dict[str, str]:
        return {"X-BB-API-Key": self.api_key, "Content-Type": "application/json"}

    def _request(self, method: str, path: str, *, json: dict | None = None) -> dict:
        try:
            response = httpx.request(
                method,
                f"{self.base_url}{path}",
                headers=self._headers,
                json=json,
                timeout=20,
                trust_env=False,
            )
        except httpx.HTTPError as exc:
            raise RemoteBrowserError("No se pudo conectar con el servicio de navegador remoto") from exc
        if response.is_error:
            message = ""
            try:
                payload = response.json()
                message = str(payload.get("message") or payload.get("error") or payload.get("detail") or "")
            except ValueError:
                pass
            suffix = f": {message[:240]}" if message else ""
            raise RemoteBrowserError(f"El navegador remoto rechazó la operación{suffix}")
        if response.status_code == 204 or not response.content:
            return {}
        payload = response.json()
        if not isinstance(payload, dict):
            raise RemoteBrowserError("El servicio de navegador remoto devolvió una respuesta inválida")
        return payload

    def create_context(self) -> str:
        payload = self._request("POST", "/contexts", json={"projectId": self.project_id})
        context_id = payload.get("id")
        if not isinstance(context_id, str) or not context_id:
            raise RemoteBrowserError("No se recibió el identificador del perfil remoto")
        return context_id

    def launch(
        self,
        *,
        context_id: str,
        profile_id: str,
        owner_id: str,
        mobile: bool,
        proxy: RemoteProxy | None,
    ) -> RemoteLaunch:
        browser_settings: dict = {
            "context": {"id": context_id, "persist": True},
            "viewport": {"width": 390, "height": 844} if mobile else {"width": 1440, "height": 900},
        }
        body: dict = {
            "projectId": self.project_id,
            "region": self.region,
            "timeout": self.timeout_seconds,
            "browserSettings": browser_settings,
            "userMetadata": {"profileId": profile_id, "ownerId": owner_id},
        }
        if proxy is not None:
            if proxy.scheme != "http":
                raise RemoteBrowserError(
                    "El navegador web admite proxies HTTP/HTTPS. Cambia este proxy antes de abrir el perfil."
                )
            proxy_payload: dict[str, str] = {
                "type": "external",
                "server": f"http://{proxy.host}:{proxy.port}",
            }
            if proxy.username:
                proxy_payload["username"] = proxy.username
            if proxy.password:
                proxy_payload["password"] = proxy.password
            body["proxies"] = [proxy_payload]

        session = self._request("POST", "/sessions", json=body)
        session_id = session.get("id")
        if not isinstance(session_id, str) or not session_id:
            raise RemoteBrowserError("No se recibió el identificador de la sesión remota")
        expires_at = _parse_datetime(session.get("expiresAt"))
        try:
            live_url = self._live_view_with_retry(session_id)
        except RemoteBrowserError:
            try:
                self.close(session_id)
            except RemoteBrowserError:
                pass
            raise
        return RemoteLaunch(session_id=session_id, live_view_url=live_url, expires_at=expires_at)

    def _live_view_with_retry(self, session_id: str) -> str:
        last_error: RemoteBrowserError | None = None
        for attempt in range(6):
            try:
                return self.live_view(session_id)
            except RemoteBrowserError as exc:
                last_error = exc
                if attempt < 5:
                    time.sleep(0.3)
        raise last_error or RemoteBrowserError("No se pudo preparar la vista del navegador")

    def live_view(self, session_id: str) -> str:
        payload = self._request("GET", f"/sessions/{session_id}/debug")
        url = payload.get("debuggerFullscreenUrl")
        if not isinstance(url, str) or not _is_https_url(url):
            raise RemoteBrowserError("El proveedor no devolvió una URL segura para abrir el navegador")
        # Keep Browserbase's navigation bar visible. The remote browser starts on
        # about:blank, so hiding it leaves web users with no way to enter a URL.
        return url

    def close(self, session_id: str) -> None:
        self._request("POST", f"/sessions/{session_id}", json={"status": "REQUEST_RELEASE"})

    def delete_context(self, context_id: str) -> None:
        self._request("DELETE", f"/contexts/{context_id}")


class MemoryRemoteBrowser:
    """Deterministic provider used only by automated tests and local demos."""

    provider = "memory"

    def __init__(self, settings: Settings) -> None:
        self.timeout_seconds = settings.browser_session_timeout_seconds

    def create_context(self) -> str:
        return f"ctx_{int(time.time_ns())}"

    def launch(
        self,
        *,
        context_id: str,
        profile_id: str,
        owner_id: str,
        mobile: bool,
        proxy: RemoteProxy | None,
    ) -> RemoteLaunch:
        del context_id, owner_id, mobile, proxy
        session_id = f"test_{profile_id}_{int(time.time_ns())}"
        return RemoteLaunch(
            session_id=session_id,
            live_view_url=f"https://browser.test.invalid/session/{session_id}",
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=self.timeout_seconds),
        )

    def live_view(self, session_id: str) -> str:
        return f"https://browser.test.invalid/session/{session_id}"

    def close(self, session_id: str) -> None:
        del session_id

    def delete_context(self, context_id: str) -> None:
        del context_id


def get_remote_browser(settings: Settings) -> RemoteBrowser:
    if settings.browser_provider == "browserbase":
        return BrowserbaseRemoteBrowser(settings)
    if settings.browser_provider == "memory":
        return MemoryRemoteBrowser(settings)
    raise RemoteBrowserError(
        "El navegador remoto no está activado. Configura BROWSER_PROVIDER=browserbase en Render."
    )


def _parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_https_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)
