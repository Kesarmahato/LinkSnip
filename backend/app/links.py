import json
import os

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import Click, Link, User
from .schemas import LinkCreate, LinkResponse, LinkUpdate
from .utils import generate_short_code

load_dotenv()

BASE_URL = os.getenv("BASE_URL", "https://linksnip.com").rstrip("/")

# =========================
# CONFIGURATION
# =========================

BASE_URL = os.getenv(
    "BASE_URL",
    "https://link-snip-backend.vercel.app",
).rstrip("/")


def _tags(link: Link) -> list[str]:
    if not link.tags:
        return []
    try:
        value = json.loads(link.tags)
        return value if isinstance(value, list) else []
    except (TypeError, json.JSONDecodeError):
        return []


def _response(link: Link, db: Session) -> LinkResponse:
    clicks = db.query(func.count(Click.id)).filter(Click.link_id == link.id).scalar() or 0
    return LinkResponse(
        id=link.id,
        original_url=link.original_url,
        short_code=link.short_code,
        short_url=f"{BASE_URL}/{link.custom_alias or link.short_code}",
        custom_alias=link.custom_alias,
        expires_at=link.expires_at,
        expires_after_clicks=link.expires_after_clicks,
        folder=link.folder,
        tags=_tags(link),
        clicks=clicks,
        created_at=link.created_at,
        is_active=link.is_active,
    )


def _generate_unique_code(db: Session) -> str:
    for _ in range(10):
        short_code = generate_short_code()
        if not db.query(Link).filter(Link.short_code == short_code).first():
            return short_code
    raise HTTPException(status_code=500, detail="Could not generate a unique short code")


def _create_link(link_data: LinkCreate, db: Session, user_id: int | None) -> LinkResponse:
    original_url = str(link_data.url)
    short_code = _generate_unique_code(db)

    if link_data.custom_alias:
        existing_alias = db.query(Link).filter(
            (Link.custom_alias == link_data.custom_alias)
            | (Link.short_code == link_data.custom_alias)
        ).first()
        if existing_alias:
            raise HTTPException(status_code=409, detail="Custom alias already exists")

    link = Link(
        user_id=user_id,
        original_url=original_url,
        short_code=short_code,
        custom_alias=link_data.custom_alias,
        expires_at=link_data.expires_at,
        expires_after_clicks=link_data.expires_after_clicks,
        folder=link_data.folder,
        tags=json.dumps(link_data.tags),
        is_active=True,
        is_password_protected=False,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return _response(link, db)


@router.post("/public", response_model=LinkResponse)
def create_public_link(link_data: LinkCreate, db: Session = Depends(get_db)):
    if link_data.custom_alias:
        raise HTTPException(status_code=403, detail="Custom aliases require an account")
    return _create_link(link_data, db, None)


@router.post("/", response_model=LinkResponse)
def create_link(
    link_data: LinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _create_link(link_data, db, current_user.id)


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
    return [_response(link, db) for link in links]


@router.put("/{link_id}", response_model=LinkResponse)
def update_link(
    link_id: int,
    link_data: LinkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(Link).filter(Link.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    if link.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to modify this link")

    if link_data.custom_alias and link_data.custom_alias != link.custom_alias:
        existing_alias = db.query(Link).filter(
            Link.id != link.id,
            (Link.custom_alias == link_data.custom_alias) | (Link.short_code == link_data.custom_alias),
        ).first()
        if existing_alias:
            raise HTTPException(status_code=409, detail="Custom alias already exists")
        link.custom_alias = link_data.custom_alias
    elif link_data.custom_alias == "":
        link.custom_alias = None

    if link_data.url is not None:
        link.original_url = str(link_data.url)
    if "expires_at" in link_data.model_fields_set:
        link.expires_at = link_data.expires_at
    if "expires_after_clicks" in link_data.model_fields_set:
        link.expires_after_clicks = link_data.expires_after_clicks
    if "folder" in link_data.model_fields_set:
        link.folder = link_data.folder
    if "tags" in link_data.model_fields_set:
        link.tags = json.dumps(link_data.tags)

    db.commit()
    db.refresh(link)
    return _response(link, db)


@router.delete("/{link_id}")
def deactivate_link(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(Link).filter(Link.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    if link.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to modify this link")
    link.is_active = False
    db.commit()
    return {"message": "Link deactivated successfully", "link_id": link.id, "is_active": False}
