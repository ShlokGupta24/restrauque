
import pytest

from app.ml import muril_sentiment


class FakeClassifier:
    """Mock classifier that avoids loading the real MuRIL model."""

    def __init__(self, predictions):
        self.predictions = predictions

    def __call__(self, texts, **kwargs):
        if isinstance(texts, str):
            return [self.predictions[0]]
        return self.predictions


def setup_fake_classifier(monkeypatch, predictions, label_mapping=None):
    if label_mapping is None:
        label_mapping = {
            "POSITIVE": "positive",
            "NEUTRAL": "neutral",
            "NEGATIVE": "negative",
        }

    fake = FakeClassifier(predictions)

    monkeypatch.setattr(
        muril_sentiment,
        "get_classifier",
        lambda: (fake, label_mapping),
    )


def test_single_review_prediction(monkeypatch):
    setup_fake_classifier(
        monkeypatch,
        [{"label": "POSITIVE", "score": 0.98}],
    )

    result = muril_sentiment.predict_sentiment("Food was delicious.")

    assert result["sentiment"] == "positive"
    assert result["confidence"] == pytest.approx(0.98)
    assert result["model_name"] == muril_sentiment.MODEL_NAME
    assert result["analysis_method"] == "transformer"


def test_batch_prediction_returns_one_result_per_review(monkeypatch):
    setup_fake_classifier(
        monkeypatch,
        [
            {"label": "POSITIVE", "score": 0.95},
            {"label": "NEGATIVE", "score": 0.91},
            {"label": "NEUTRAL", "score": 0.80},
        ],
    )

    reviews = [
        "Food was amazing.",
        "Service was terrible.",
        "The meal was ordinary.",
    ]

    results = muril_sentiment.predict_sentiment_batch(reviews)

    assert len(results) == len(reviews)
    assert [r["sentiment"] for r in results] == [
        "positive",
        "negative",
        "neutral",
    ]


def test_empty_batch_returns_empty_list():
    assert muril_sentiment.predict_sentiment_batch([]) == []


@pytest.mark.parametrize("review", ["", "   ", None, 123])
def test_invalid_single_review_is_rejected(review):
    with pytest.raises(ValueError):
        muril_sentiment.predict_sentiment(review)


def test_blank_review_in_batch_is_rejected():
    with pytest.raises(ValueError):
        muril_sentiment.predict_sentiment_batch(
            ["A good meal.", "   "]
        )


def test_invalid_batch_size_is_rejected():
    with pytest.raises(ValueError):
        muril_sentiment.predict_sentiment_batch(
            ["Good food."],
            batch_size=0,
        )


def test_unknown_model_output_label_is_rejected(monkeypatch):
    setup_fake_classifier(
        monkeypatch,
        [{"label": "UNKNOWN_LABEL", "score": 0.90}],
    )

    with pytest.raises(ValueError, match="Unexpected MuRIL output label"):
        muril_sentiment.predict_sentiment("The food was good.")
