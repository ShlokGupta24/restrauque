from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


@lru_cache(maxsize=1)
def get_engine():
    """Create the database engine only when database access is needed."""
    settings.validate_database_url()

    return create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=3,
        max_overflow=2,
        pool_timeout=30,
    )


@lru_cache(maxsize=1)
def get_session_factory():
    """Return the reusable SQLAlchemy session factory."""
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

