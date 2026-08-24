from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from user_agents import parse

from .database import get_db
from .models import Click, Link

router = APIRouter()


@router.get("/{short_code}")
def redirect_link(short_code: str, request: Request, db: Session = Depends(get_db)):
    link = db.query(Link).filter(
        (Link.short_code == short_code) | (Link.custom_alias == short_code)
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Short link not found")
    if not link.is_active:
        raise HTTPException(status_code=410, detail="This link has been disabled")
    if link.expires_at and link.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=410, detail="This link has expired")

    current_clicks = db.query(func.count(Click.id)).filter(Click.link_id == link.id).scalar() or 0
    if link.expires_after_clicks and current_clicks >= link.expires_after_clicks:
        raise HTTPException(status_code=410, detail="This link has reached its click limit")

    forwarded_for = request.headers.get("x-forwarded-for")
    ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else None)
    referrer = request.headers.get("referer")
    user_agent_string = request.headers.get("user-agent")
    country = request.headers.get("cf-ipcountry") or request.headers.get("x-country")
    city = request.headers.get("cf-ipcity") or request.headers.get("x-city")
    ua = parse(user_agent_string or "")
    device_type = "Mobile" if ua.is_mobile else "Tablet" if ua.is_tablet else "Desktop" if ua.is_pc else "Other"

    click = Click(
        link_id=link.id,
        ip_address=ip_address,
        referrer=referrer,
        country=country,
        city=city,
        user_agent=user_agent_string,
        browser=ua.browser.family,
        operating_system=ua.os.family,
        device_type=device_type,
    )
    db.add(click)
    db.commit()

    return RedirectResponse(url=link.original_url, status_code=302)
