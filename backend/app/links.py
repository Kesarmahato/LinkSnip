from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import Link
from .schemas import LinkCreate, LinkResponse
from .utils import generate_short_code


router = APIRouter(
    prefix="/api/links",
    tags=["Links"],
)


@router.post("/", response_model=LinkResponse)
def create_link(
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
            .filter(Link.custom_alias == link_data.custom_alias)
            .first()
        )

        if existing_alias:
            raise HTTPException(
                status_code=409,
                detail="Custom alias already exists",
            )

    # Temporary user ID until authentication is implemented
    user_id = 1

    link = Link(
        user_id=user_id,
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
        short_url=f"http://localhost:8000/{link.custom_alias or link.short_code}",
        custom_alias=link.custom_alias,
        expires_at=link.expires_at,
        is_active=link.is_active,
    )