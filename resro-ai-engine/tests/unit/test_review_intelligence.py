
from app.services.review_intelligence import (
    analyze_review,
    summarize_reviews,
)


def test_positive_review():
    result = analyze_review(
        "The coffee was amazing and delicious!",
        rating=5,
    )

    assert result["sentiment"] == "positive"
    assert "food" in result["aspects"]


def test_negative_review():
    result = analyze_review(
        "The food was terrible and the staff were rude.",
        rating=1,
    )

    assert result["sentiment"] == "negative"
    assert "food" in result["aspects"]
    assert "service" in result["aspects"]


def test_neutral_review():
    result = analyze_review(
        "I ordered a cappuccino.",
        rating=3,
    )

    assert result["sentiment"] == "neutral"


def test_rating_does_not_override_text():
    result = analyze_review(
        "The food was terrible.",
        rating=5,
    )

    assert result["sentiment"] == "negative"


def test_empty_summary():
    result = summarize_reviews([])

    assert result["total_reviews"] == 0
    assert result["average_rating"] is None
    assert result["sentiment_percentages"] == {
        "positive": 0.0,
        "neutral": 0.0,
        "negative": 0.0,
    }


def test_summary_counts_reviews():
    result = summarize_reviews([
        {"text": "Amazing coffee!", "rating": 5},
        {"text": "Terrible service.", "rating": 1},
    ])

    assert result["total_reviews"] == 2
    assert result["average_rating"] == 3.0
