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


def test_analytics_counts_clicks():
    token = login()

    headers = {
        "Authorization": f"Bearer {token}",
    }

    # Create a link
    response = client.post(
        "/api/links/",
        headers=headers,
        json={
            "url": "https://www.python.org/",
        },
    )

    assert response.status_code == 200

    data = response.json()

    link_id = data["id"]
    short_code = data["short_code"]

    # Visit the short URL twice
    response = client.get(
        f"/{short_code}",
        follow_redirects=False,
    )

    assert response.status_code == 307

    response = client.get(
        f"/{short_code}",
        follow_redirects=False,
    )

    assert response.status_code == 307

    # Get analytics
    response = client.get(
        f"/api/links/{link_id}/analytics",
        headers=headers,
    )

    assert response.status_code == 200

    analytics = response.json()

    assert analytics["link_id"] == link_id
    assert analytics["short_code"] == short_code
    assert analytics["total_clicks"] == 2
def test_analytics_requires_link_owner():
    token = login()

    headers = {
        "Authorization": f"Bearer {token}",
    }

    # Create a link owned by the logged-in user
    response = client.post(
        "/api/links/",
        headers=headers,
        json={
            "url": "https://example.com/private",
        },
    )

    assert response.status_code == 200

    link_id = response.json()["id"]

    # Use a different/non-owner user token.
    # Register a fresh user first.
    email = "analytics-owner-test@example.com"

    register_response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "TestPassword123",
        },
    )

    assert register_response.status_code in (200, 409)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": "TestPassword123",
        },
    )

    assert login_response.status_code == 200

    other_token = login_response.json()["access_token"]

    response = client.get(
        f"/api/links/{link_id}/analytics",
        headers={
            "Authorization": f"Bearer {other_token}",
        },
    )

    assert response.status_code == 403
