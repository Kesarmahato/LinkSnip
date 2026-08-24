from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password
from app.database import Base, get_db
from app.main import app
from app.models import User


# ============================================================
# TEST DATABASE
# ============================================================

TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ============================================================
# CREATE TEST DATABASE + TEST USER
# ============================================================

@pytest.fixture(scope="session", autouse=True)
def create_test_database():
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()

    try:
        test_user = (
            db.query(User)
            .filter(User.email == "testuser3@example.com")
            .first()
        )

        if not test_user:
            test_user = User(
                email="testuser3@example.com",
                password_hash=hash_password("TestPassword123"),
                is_verified=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )

            db.add(test_user)
            db.commit()

    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=engine)


# ============================================================
# FASTAPI DATABASE DEPENDENCY OVERRIDE
# ============================================================

def override_get_db():
    db = TestingSessionLocal()

    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ============================================================
# TEST CLIENT
# ============================================================

@pytest.fixture()
def client():
    return TestClient(app)