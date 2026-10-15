from hmac import compare_digest

from fastapi import Header, HTTPException

from app.core.config import settings


def require_service_token(
    x_service_token: str | None = Header(
        default=None,
        alias="X-Service-Token",
    ),
) -> None:
    """Allow requests only from a caller with the configured service token."""

    expected_token = settings.AI_SERVICE_TOKEN

    # Fail closed if the service has not been configured securely.
    if not expected_token:
        raise HTTPException(
            status_code=503,
            detail="AI service authentication is not configured.",
        )

    if not x_service_token or not compare_digest(
        x_service_token,
        expected_token,
    ):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid service token.",
        )