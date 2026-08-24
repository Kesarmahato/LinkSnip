from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from user_agents import parse

from app.database import get_db
from app.links import router as links_router
from app.analytics import router as analytics_router
from app.auth import router as auth_router
from app.models import Click, Link



app = FastAPI(
    title="LinkSnip API",
    description="Free URL Shortening and Analytics Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(links_router)
app.include_router(analytics_router)
app.include_router(auth_router)

@app.get("/")
def root():
    return {
        "message": "LinkSnip API is running",
        "version": "1.0.0",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/{short_code}")
def redirect_to_original(
    short_code: str,
    request: Request,
    db: Session = Depends(get_db),
):
    # Find link using custom alias OR generated short code
    link = (
        db.query(Link)
        .filter(
            (Link.custom_alias == short_code)
            | (Link.short_code == short_code)
        )
        .first()
    )

    # Link not found
    if not link:
        raise HTTPException(
            status_code=404,
            detail="Link not found",
        )

    # Link disabled
    if not link.is_active:
        raise HTTPException(
            status_code=404,
            detail="Link is inactive",
        )

    # Link expired
    if link.expires_at and link.expires_at <= datetime.utcnow():
        raise HTTPException(
            status_code=410,
            detail="Link has expired",
        )

    # CLICK ANALYTICS
    user_agent_string = request.headers.get("user-agent")
    referrer = request.headers.get("referer")

    ua = parse(user_agent_string or "")

    if ua.is_mobile:
        device_type = "Mobile"
    elif ua.is_tablet:
        device_type = "Tablet"
    elif ua.is_pc:
        device_type = "Desktop"
    else:
        device_type = "Other"

    ip_address = None

    if request.client:
        ip_address = request.client.host

    click = Click(
        link_id=link.id,
        ip_address=ip_address,
        referrer=referrer,
        user_agent=user_agent_string,
        browser=ua.browser.family,
        operating_system=ua.os.family,
        device_type=device_type,
    )

    db.add(click)
    db.commit()

    # REDIRECT
    return RedirectResponse(
        url=link.original_url,
        status_code=302,
    )