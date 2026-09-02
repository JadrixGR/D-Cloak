from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture()
def client(tmp_path):
    settings = Settings(
        environment="test",
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        jwt_secret="test-secret-that-is-long-enough-for-tests",
        profile_data_key="independent-test-vault-key",
        admin_email="admin@example.com",
        admin_initial_password="AdminPassword!123",
        default_server_ip="203.0.113.24",
        browser_provider="memory",
        auto_create_schema=True,
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture()
def admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "AdminPassword!123"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}
