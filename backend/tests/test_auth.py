from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def login():
    response = client.post(
        "/api/auth/login",
        json={
            "email": "testuser3@example.com",
            "password": "TestPassword123",
        },
    )

    assert response.status_code == 200

    return response.json()["access_token"]


def test_register():
    response = client.post(
        "/api/auth/register",
        json={
            "email": "pytest_user@example.com",
            "password": "TestPassword123",
        },
    )

    assert response.status_code in (200, 409)


def test_login():
    response = client.post(
        "/api/auth/login",
        json={
            "email": "testuser3@example.com",
            "password": "TestPassword123",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_invalid_login():
    response = client.post(
        "/api/auth/login",
        json={
            "email": "testuser3@example.com",
            "password": "WrongPassword123",
        },
    )

    assert response.status_code == 401


def test_me_requires_authentication():
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_me_returns_current_user():
    token = login()

    response = client.get(
        "/api/auth/me",
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["email"] == "testuser3@example.com"
    assert data["id"]
    assert "is_verified" in data