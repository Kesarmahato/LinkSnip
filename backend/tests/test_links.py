from fastapi.testclient import TestClient
import uuid

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


def test_create_link():
    token = login()

    response = client.post(
        "/api/links/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json={
            "url": "https://example.com",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["original_url"].rstrip("/") == "https://example.com"
    assert data["short_code"]
    assert data["short_url"]
    assert data["is_active"] is True


def test_custom_alias():
    token = login()

    alias = f"pytest-{uuid.uuid4().hex[:8]}"

    response = client.post(
        "/api/links/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json={
            "url": "https://example.com/custom",
            "custom_alias": alias,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["custom_alias"] == alias
    assert data["short_url"].endswith(f"/{alias}")


def test_duplicate_alias():
    token = login()

    headers = {
        "Authorization": f"Bearer {token}",
    }

    # First create the alias.
    first_response = client.post(
        "/api/links/",
        headers=headers,
        json={
            "url": "https://example.com/duplicate",
            "custom_alias": "pytestalias123",
        },
    )

    assert first_response.status_code == 200

    # Try to create the same alias again.
    second_response = client.post(
        "/api/links/",
        headers=headers,
        json={
            "url": "https://example.com/duplicate-2",
            "custom_alias": "pytestalias123",
        },
    )

    assert second_response.status_code == 409


def test_redirect_to_original():
    token = login()

    response = client.post(
        "/api/links/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json={
            "url": "https://www.python.org/",
        },
    )

    assert response.status_code == 200

    data = response.json()
    short_code = data["short_code"]

    response = client.get(
        f"/{short_code}",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"] == "https://www.python.org/"


def test_deactivate_link():
    token = login()

    response = client.post(
        "/api/links/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json={
            "url": "https://www.example.org/",
        },
    )

    assert response.status_code == 200

    data = response.json()

    link_id = data["id"]
    short_code = data["short_code"]

    response = client.delete(
        f"/api/links/{link_id}",
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 200

    response = client.get(
        f"/{short_code}",
        follow_redirects=False,
    )

    assert response.status_code == 404