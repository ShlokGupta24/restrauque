
import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def configure_test_service_token(monkeypatch):
    monkeypatch.setattr(
        settings,
        "AI_SERVICE_TOKEN",
        "test-secret",
    )
