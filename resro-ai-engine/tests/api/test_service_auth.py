
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_review_endpoint_rejects_missing_token(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_TOKEN", "test-secret")

    response = client.post(
        "/api/v1/ai/reviews/analyze",
        json={"text": "Food was excellent.", "rating": 5},
    )

    assert response.status_code == 401


def test_review_endpoint_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_TOKEN", "test-secret")

    response = client.post(
        "/api/v1/ai/reviews/analyze",
        headers={"X-Service-Token": "wrong-secret"},
        json={"text": "Food was excellent.", "rating": 5},
    )

    assert response.status_code == 401


def test_review_endpoint_accepts_valid_token(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_TOKEN", "test-secret")

    response = client.post(
        "/api/v1/ai/reviews/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={"text": "Food was excellent.", "rating": 5},
    )

    assert response.status_code == 200
    assert response.json()["sentiment"] == "positive"


def test_review_endpoint_fails_closed_without_configuration(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_TOKEN", "")

    response = client.post(
        "/api/v1/ai/reviews/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={"text": "Food was excellent.", "rating": 5},
    )

    assert response.status_code == 503
