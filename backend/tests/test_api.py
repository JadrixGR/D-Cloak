from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


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
    assert started.json()["status"] == "running"
    assert started.json()["sessions_today"] == 1

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
