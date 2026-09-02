from __future__ import annotations

import httpx
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.remote_browser import BrowserbaseRemoteBrowser, RemoteProxy


def create_profile(client: TestClient, headers: dict[str, str], name: str = "QA aislado"):
    return client.post(
        "/api/profiles",
        headers=headers,
        json={
            "name": name,
            "os": "Linux",
            "timezone": "America/Lima",
            "locale": "es-PE",
            "use_default_ip": True,
            "proxy_id": None,
        },
    )


def test_login_and_profile_lifecycle(client: TestClient, admin_headers: dict[str, str]):
    created = create_profile(client, admin_headers)
    assert created.status_code == 201
    profile = created.json()
    assert profile["effective_ip"] == "203.0.113.24"

    started = client.post(f"/api/profiles/{profile['id']}/start", headers=admin_headers)
    assert started.status_code == 200
    launch = started.json()
    assert launch["profile"]["status"] == "running"
    assert launch["profile"]["sessions_today"] == 1
    assert launch["live_view_url"].startswith("https://browser.test.invalid/session/")

    reopened = client.post(f"/api/profiles/{profile['id']}/start", headers=admin_headers)
    assert reopened.status_code == 200
    assert reopened.json()["live_view_url"] == launch["live_view_url"]
    assert reopened.json()["profile"]["sessions_today"] == 1

    stopped = client.post(f"/api/profiles/{profile['id']}/stop", headers=admin_headers)
    assert stopped.status_code == 200
    assert stopped.json()["status"] == "paused"


def test_profile_vault_is_scoped_and_encrypted(client: TestClient, admin_headers: dict[str, str]):
    profile = create_profile(client, admin_headers).json()
    payload = {
        "cookies": [
            {
                "name": "session",
                "value": "sensitive-cookie-value",
                "domain": "example.com",
                "path": "/",
                "expires": None,
                "secure": True,
                "http_only": True,
                "same_site": "Lax",
            }
        ],
        "local_storage": {"https://example.com": {"theme": "dark"}},
    }
    saved = client.put(f"/api/profiles/{profile['id']}/storage", headers=admin_headers, json=payload)
    assert saved.status_code == 200
    assert saved.headers["cache-control"] == "no-store"
    loaded = client.get(f"/api/profiles/{profile['id']}/storage", headers=admin_headers)
    assert loaded.json() == payload


def test_standard_user_cannot_access_admin_or_other_profile(client: TestClient, admin_headers: dict[str, str]):
    other_profile = create_profile(client, admin_headers, "Solo administrador").json()
    created_user = client.post(
        "/api/users",
        headers=admin_headers,
        json={"email": "user@example.com", "name": "User One", "role": "user"},
    )
    assert created_user.status_code == 201
    temporary = created_user.json()["temporary_password"]
    login = client.post(
        "/api/auth/login", json={"email": "user@example.com", "password": temporary}
    )
    user_headers = {"Authorization": f"Bearer {login.json()['token']}"}

    assert client.get("/api/users", headers=user_headers).status_code == 403
    assert client.get(f"/api/profiles/{other_profile['id']}/storage", headers=user_headers).status_code == 404
    assert client.get("/api/profiles", headers=user_headers).json() == []


def test_private_proxy_is_rejected_by_safe_test(client: TestClient, admin_headers: dict[str, str]):
    proxy = client.post(
        "/api/proxies",
        headers=admin_headers,
        json={
            "label": "Loopback bloqueado",
            "type": "http",
            "host": "127.0.0.1",
            "port": 8080,
            "username": None,
            "password": None,
            "country": "PE",
        },
    ).json()
    tested = client.post(f"/api/proxies/{proxy['id']}/test", headers=admin_headers)
    assert tested.status_code == 200
    assert tested.json()["healthy"] is False


def test_password_change_revokes_previous_token(client: TestClient, admin_headers: dict[str, str]):
    changed = client.post(
        "/api/auth/password",
        headers=admin_headers,
        json={
            "current_password": "AdminPassword!123",
            "new_password": "A-New-Admin-Password!456",
        },
    )
    assert changed.status_code == 204
    assert client.get("/api/auth/me", headers=admin_headers).status_code == 401
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "A-New-Admin-Password!456"},
    )
    assert login.status_code == 200


def test_legacy_local_admin_email_is_normalized(tmp_path):
    settings = Settings(
        environment="test",
        database_url=f"sqlite:///{tmp_path / 'legacy-admin.db'}",
        jwt_secret="test-secret-that-is-long-enough-for-tests",
        profile_data_key="independent-test-vault-key",
        admin_email="admin@novashield.local",
        admin_initial_password="AdminPassword!123",
        default_server_ip="203.0.113.24",
        auto_create_schema=True,
    )

    with TestClient(create_app(settings)) as test_client:
        login = test_client.post(
            "/api/auth/login",
            json={"email": "admin@novashield.app", "password": "AdminPassword!123"},
        )

    assert login.status_code == 200
    assert login.json()["user"]["email"] == "admin@novashield.app"


def test_disabled_browser_never_reports_a_fake_running_profile(tmp_path):
    settings = Settings(
        environment="test",
        database_url=f"sqlite:///{tmp_path / 'disabled-browser.db'}",
        jwt_secret="test-secret-that-is-long-enough-for-tests",
        profile_data_key="independent-test-vault-key",
        admin_email="admin@example.com",
        admin_initial_password="AdminPassword!123",
        default_server_ip="203.0.113.24",
        browser_provider="disabled",
        auto_create_schema=True,
    )
    with TestClient(create_app(settings)) as test_client:
        login = test_client.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": "AdminPassword!123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['token']}"}
        profile = create_profile(test_client, headers).json()
        started = test_client.post(f"/api/profiles/{profile['id']}/start", headers=headers)
        stored = test_client.get("/api/profiles", headers=headers).json()[0]

    assert started.status_code == 503
    assert "no está activado" in started.json()["detail"]
    assert stored["status"] == "stopped"


def test_browserbase_launch_uses_persistent_context_and_profile_proxy(monkeypatch):
    calls: list[tuple[str, str, dict | None]] = []

    def fake_request(method, url, *, headers, json, timeout, trust_env):
        del headers, timeout, trust_env
        calls.append((method, url, json))
        if url.endswith("/contexts"):
            return httpx.Response(201, json={"id": "ctx_real"})
        if url.endswith("/sessions"):
            return httpx.Response(
                201,
                json={
                    "id": "session_real",
                    "expiresAt": "2026-09-02T20:00:00Z",
                },
            )
        if url.endswith("/sessions/session_real/debug"):
            return httpx.Response(
                200,
                json={"debuggerFullscreenUrl": "https://live.browserbase.test/session_real"},
            )
        raise AssertionError(f"Petición inesperada: {method} {url}")

    monkeypatch.setattr(httpx, "request", fake_request)
    settings = Settings(
        environment="test",
        browser_provider="browserbase",
        browserbase_api_key="test-key",
        browserbase_project_id="project-id",
    )
    remote = BrowserbaseRemoteBrowser(settings)
    context_id = remote.create_context()
    launch = remote.launch(
        context_id=context_id,
        profile_id="pf_1",
        owner_id="u_1",
        mobile=False,
        proxy=RemoteProxy(
            scheme="http",
            host="proxy.example.com",
            port=8080,
            username="proxy-user",
            password="proxy-pass",
        ),
    )

    session_payload = calls[1][2]
    assert session_payload is not None
    assert session_payload["browserSettings"]["context"] == {"id": "ctx_real", "persist": True}
    assert session_payload["proxies"] == [
        {
            "type": "external",
            "server": "http://proxy.example.com:8080",
            "username": "proxy-user",
            "password": "proxy-pass",
        }
    ]
    assert launch.live_view_url == "https://live.browserbase.test/session_real"
