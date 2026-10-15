from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import get_engine

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    return {
        "service": "resro-ai-engine",
        "status": "healthy",
        "version": "0.1.0",
    }


@router.get("/health/db")
def database_health_check():
    try:
        engine = get_engine()

        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT current_database(), current_user")
            )
            database_name, database_user = result.one()

        return {
            "service": "resro-ai-engine",
            "database_status": "connected",
            "database": database_name,
            "database_user": database_user,
        }

    except (SQLAlchemyError, ValueError, RuntimeError):
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        ) from None
