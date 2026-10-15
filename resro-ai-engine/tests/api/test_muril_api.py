
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.routes import reviews as review_routes


client = TestClient(app)


def fake_prediction(text):
    return {
        "sentiment": "positive",
        "confidence": 0.95,
        "model_name": "airzipm/sentiment-analysis-muril-v2",
        "analysis_method": "transformer",
    }


def test_transformer_analyze_endpoint(monkeypatch):
    monkeypatch.setattr(
        review_routes,
        "predict_sentiment",
        fake_prediction,
    )

    response = client.post(
        "/api/v1/ai/reviews/transformer/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={
            "text": "Khana bahut accha tha.",
            "rating": 5,
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["sentiment"] == "positive"
    assert data["confidence"] == 0.95
    assert data["rating"] == 5
    assert data["analysis_method"] == "transformer"


def test_transformer_batch_endpoint(monkeypatch):
    def fake_batch(texts, batch_size=8):
        return [
            {
                "sentiment": "positive",
                "confidence": 0.95,
                "model_name": "airzipm/sentiment-analysis-muril-v2",
                "analysis_method": "transformer",
            }
            for _ in texts
        ]

    monkeypatch.setattr(
        review_routes,
        "predict_sentiment_batch",
        fake_batch,
    )

    response = client.post(
        "/api/v1/ai/reviews/transformer/analyze-batch",
        headers={"X-Service-Token": "test-secret"},
        json={
            "reviews": [
                {"text": "Food was delicious.", "rating": 5},
                {"text": "Service was great.", "rating": 4},
            ]
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["total_reviews"] == 2
    assert len(data["results"]) == 2
    assert all(
        result["analysis_method"] == "transformer"
        for result in data["results"]
    )


def test_transformer_analyze_rejects_empty_text():
    response = client.post(
        "/api/v1/ai/reviews/transformer/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={"text": "", "rating": 3},
    )

    assert response.status_code == 422


def test_transformer_analyze_rejects_invalid_rating():
    response = client.post(
        "/api/v1/ai/reviews/transformer/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={"text": "Good food.", "rating": 6},
    )

    assert response.status_code == 422


def test_transformer_batch_rejects_empty_review_list():
    response = client.post(
        "/api/v1/ai/reviews/transformer/analyze-batch",
        headers={"X-Service-Token": "test-secret"},
        json={"reviews": []},
    )

    # ReviewBatchInput should enforce a minimum list length of 1.
    assert response.status_code == 422


def test_transformer_single_returns_503_on_inference_failure(monkeypatch):
    def failing_prediction(text):
        raise RuntimeError("Internal model-loading details")

    monkeypatch.setattr(
        review_routes,
        "predict_sentiment",
        failing_prediction,
    )

    response = client.post(
        "/api/v1/ai/reviews/transformer/analyze",
        headers={"X-Service-Token": "test-secret"},
        json={"text": "Food was good.", "rating": 4},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == (
        "Sentiment analysis is temporarily unavailable."
    )
    assert "Internal model-loading details" not in response.text


def test_transformer_batch_returns_503_on_prediction_count_mismatch(
    monkeypatch,
):
    monkeypatch.setattr(
        review_routes,
        "predict_sentiment_batch",
        lambda texts: [],
    )

    response = client.post(
        "/api/v1/ai/reviews/transformer/analyze-batch",
        headers={"X-Service-Token": "test-secret"},
        json={
            "reviews": [
                {"text": "Food was delicious.", "rating": 5},
            ]
        },
    )

    assert response.status_code == 503
    assert response.json()["detail"] == (
        "Sentiment analysis returned an incomplete result."
    )
