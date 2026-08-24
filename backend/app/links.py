import os

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import Link, User
from .schemas import LinkCreate, LinkResponse
from .utils import generate_short_code


load_dotenv()


# =========================
# CONFIGURATION
# =========================

BASE_URL = os.getenv(
    "BASE_URL",
    "http://localhost:8000",
).rstrip("/")


router = APIRouter(
    prefix="/api/links",
    tags=["Links"],
)


# =========================
# CREATE LINK
# =========================

@router.post("/", response_model=LinkResponse)
def create_link(
    link_data: LinkCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    # Convert Pydantic HttpUrl to string
    original_url = str(link_data.url)

    # =========================
    # GENERATE UNIQUE SHORT CODE
    # =========================

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

    # =========================
    # CHECK CUSTOM ALIAS
    # =========================

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

    # =========================
    # CREATE LINK
    # =========================

    link = Link(
        user_id=current_user.id,
        original_url=original_url,
        short_code=short_code,
        custom_alias=link_data.custom_alias,
        expires_at=link_data.expires_at,
        is_active=True,
        is_password_protected=False,
    )

    db.add(link)
    db.commit()
    db.refresh(link)

    # =========================
    # RESPONSE
    # =========================

    return LinkResponse(
        id=link.id,
        original_url=link.original_url,
        short_code=link.short_code,
        short_url=f"{BASE_URL}/{link.custom_alias or link.short_code}",
        custom_alias=link.custom_alias,
        expires_at=link.expires_at,
        is_active=link.is_active,
    )


# =========================
# LIST USER LINKS
# =========================

@router.get("/", response_model=list[LinkResponse])
def list_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    links = (
        db.query(Link)
        .filter(Link.user_id == current_user.id)
        .order_by(Link.created_at.desc())
        .all()
    )

    return [
        LinkResponse(
            id=link.id,
            original_url=link.original_url,
            short_code=link.short_code,
            short_url=f"{BASE_URL}/{link.custom_alias or link.short_code}",
            custom_alias=link.custom_alias,
            expires_at=link.expires_at,
            is_active=link.is_active,
        )
        for link in links
    ]


# =========================
# DEACTIVATE LINK
# =========================

@router.delete("/{link_id}")
def deactivate_link(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find the link
    link = (
        db.query(Link)
        .filter(Link.id == link_id)
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=404,
            detail="Link not found",
        )

    # Check ownership
    if link.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to modify this link",
        )

    # Deactivate the link
    link.is_active = False

    db.commit()
    db.refresh(link)

    return {
        "message": "Link deactivated successfully",
        "link_id": link.id,
        "is_active": link.is_active,
    }