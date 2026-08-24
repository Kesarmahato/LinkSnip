from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from .database import get_db
from .models import Link, Click


router = APIRouter()


@router.get("/{short_code}")
def redirect_link(
    short_code: str,
    request: Request,
    db: Session = Depends(get_db),
):
    # Find link by short code or custom alias
    link = (
        db.query(Link)
        .filter(
            (Link.short_code == short_code)
            | (Link.custom_alias == short_code)
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=404,
            detail="Short link not found",
        )

    # Check whether link is disabled
    if not link.is_active:
        raise HTTPException(
            status_code=410,
            detail="This link has been disabled",
        )

    # Check expiration
    if (
        link.expires_at
        and link.expires_at <= datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=410,
            detail="This link has expired",
        )

    # Collect click metadata
    forwarded_for = request.headers.get("x-forwarded-for")

    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    else:
        ip_address = (
            request.client.host
            if request.client
            else None
        )

    referrer = request.headers.get("referer")
    user_agent = request.headers.get("user-agent")

    # Record click
    click = Click(
        link_id=link.id,
        ip_address=ip_address,
        referrer=referrer,
        user_agent=user_agent,
    )

    db.add(click)
    db.commit()

    # Redirect
    return RedirectResponse(
        url=link.original_url,
        status_code=302,
    )