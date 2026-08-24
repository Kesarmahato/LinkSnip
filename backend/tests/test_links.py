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

@router.post("/public", response_model=LinkResponse)
def create_public_link(
    link_data: LinkCreate,
    db: Session = Depends(get_db),
):
    # Generate a unique short code
    for _ in range(10):
        short_code = generate_short_code()

        existing_link = (
            db.query(Link)
            .filter(Link.short_code == short_code)
            .first()
        )

        if not existing_link:
            break
    else:
        raise HTTPException(
            status_code=500,
            detail="Could not generate a unique short code",
        )

    # Check custom alias
    if link_data.custom_alias:
        existing_alias = (
            db.query(Link)
            .filter(
                (Link.custom_alias == link_data.custom_alias)
                | (Link.short_code == link_data.custom_alias)
            )
            .first()
        )

        if existing_alias:
            raise HTTPException(
                status_code=409,
                detail="Custom alias already exists",
            )

    # Create anonymous link
    link = Link(
        user_id=None,
        original_url=str(link_data.url),
        short_code=short_code,
        custom_alias=link_data.custom_alias,
        expires_at=link_data.expires_at,
        is_active=True,
        is_password_protected=False,
    )

    db.add(link)
    db.commit()
    db.refresh(link)

    return LinkResponse(
        id=link.id,
        original_url=link.original_url,
        short_code=link.short_code,
        short_url=f"{BASE_URL}/{link.custom_alias or link.short_code}",
        custom_alias=link.custom_alias,
        expires_at=link.expires_at,
        is_active=link.is_active,
    )

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