from fastapi import FastAPI
from sqlalchemy import inspect, text
from app.database import engine
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from user_agents import parse

from app.database import Base, engine, get_db
from app.links import router as links_router
from app.analytics import router as analytics_router
from app.auth import router as auth_router
from app.redirect import router as redirect_router



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


@app.on_event("startup")
def create_database_tables():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {
        "message": "LinkSnip API is running",
        "version": "1.0.0",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}




def ensure_link_columns():
    """Add new optional link-management columns to an existing MVP database."""
    inspector = inspect(engine)
    if "links" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("links")}
    additions = {
        "expires_after_clicks": "INTEGER",
        "folder": "VARCHAR(100)",
        "tags": "TEXT",
    }

    with engine.begin() as connection:
        for name, sql_type in additions.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE links ADD COLUMN {name} {sql_type}"))


@app.on_event("startup")
def startup():
    from app.database import Base
    from app.models import Click, Link, User
    Base.metadata.create_all(bind=engine)
    ensure_link_columns()

app.include_router(redirect_router)
