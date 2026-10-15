from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_analyze_review_endpoint():
    response = client.post(
        "/api/v1/ai/reviews/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={
            "text": "The food was amazing and the staff were friendly.",
            "rating": 5,
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert "sentiment" in data
    assert "sentiment_score" in data
    assert "aspects" in data
    assert data["sentiment"] == "positive"


def test_analyze_negative_review():
    response = client.post(
        "/api/v1/ai/reviews/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={
            "text": "The food was terrible and the service was slow.",
            "rating": 1,
        },
    )

    assert response.status_code == 200
    assert response.json()["sentiment"] == "negative"


def test_analyze_review_without_rating():
    response = client.post(
        "/api/v1/ai/reviews/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={"text": "The coffee was delicious!"},
    )

    assert response.status_code == 200
    assert response.json()["sentiment"] == "positive"


def test_analyze_review_rejects_empty_text():
    response = client.post(
        "/api/v1/ai/reviews/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={"text": "", "rating": 3},
    )

    assert response.status_code == 422


def test_analyze_review_rejects_invalid_rating():
    response = client.post(
        "/api/v1/ai/reviews/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={"text": "Good coffee", "rating": 6},
    )

    assert response.status_code == 422


def test_review_summary_endpoint():
    response = client.post(
        "/api/v1/ai/reviews/summary",
        headers={"X-Service-Token": "test-secret"},
        json={
            "reviews": [
                {
                    "text": "Amazing food and great service!",
                    "rating": 5,
                },
                {
                    "text": "Terrible food and rude staff.",
                    "rating": 1,
                },
            ]
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["total_reviews"] == 2
    assert data["average_rating"] == 3.0
