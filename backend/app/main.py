from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.links import router as links_router
from app.models import Click, Link
from app.database import get_db
from app.models import Link
from app.schemas import LinkCreate, LinkResponse
from app.utils import generate_short_code


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


@app.get("/")
def root():
    return {
        "message": "LinkSnip API is running",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


@app.get("/{short_code}")
def redirect_to_original(
    short_code: str,
    db: Session = Depends(get_db),
):
    link = (
        db.query(Link)
        .filter(
            (Link.custom_alias == short_code)
            | (Link.short_code == short_code)
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=404,
            detail="Short link not found",
        )

    if not link.is_active:
        raise HTTPException(
            status_code=410,
            detail="Short link is inactive",
        )

    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=410,
            detail="Short link has expired",
        )

    click = Click(
        link_id=link.id,
    )

    db.add(click)
    db.commit()

    return RedirectResponse(
        url=link.original_url,
        status_code=307,
    )