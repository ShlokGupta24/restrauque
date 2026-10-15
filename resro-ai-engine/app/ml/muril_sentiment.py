
from functools import lru_cache
from typing import Any
from pathlib import Path

from transformers import pipeline


from app.core.config import settings

MODEL_NAME = settings.MURIL_MODEL_NAME
MODEL_PATH = (
    Path(__file__).resolve().parents[2]
    / "models"
    / "muril-sentiment-v2"
)


VALID_SENTIMENTS = {"positive", "neutral", "negative"}


def normalize_label(label: str) -> str:
    """Normalize common sentiment label names."""
    label = label.strip().lower()

    aliases = {
        "positive": "positive",
        "pos": "positive",
        "negative": "negative",
        "neg": "negative",
        "neutral": "neutral",
        "neu": "neutral",
    }

    if label not in aliases:
        raise ValueError(
            f"Unrecognized sentiment label: {label!r}. "
            "Verify the model's id2label mapping before using it."
        )

    return aliases[label]



@lru_cache(maxsize=1)
def get_classifier():
    """Load the pinned local MuRIL snapshot once per process."""
    if not MODEL_PATH.is_dir():
        raise FileNotFoundError(
            f"Local MuRIL model directory not found: {MODEL_PATH}. "
            "Run the model download script before starting the service."
        )

    classifier = pipeline(
        task="text-classification",
        model=str(MODEL_PATH),
        tokenizer=str(MODEL_PATH),
        local_files_only=True,
    )

    raw_mapping = classifier.model.config.id2label
    label_mapping = {}

    for raw_label in raw_mapping.values():
        label_mapping[str(raw_label)] = normalize_label(str(raw_label))

    if set(label_mapping.values()) != VALID_SENTIMENTS:
        raise ValueError(
            "MuRIL must expose positive, neutral and negative classes. "
            f"Configured labels: {raw_mapping}"
        )

    return classifier, label_mapping




def predict_sentiment(text: str) -> dict[str, Any]:
    """Predict sentiment for one review."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Review text must be a non-empty string.")

    classifier, label_mapping = get_classifier()

    prediction = classifier(
        text.strip(),
        truncation=True,
    )[0]

    raw_label = prediction["label"]

    if raw_label not in label_mapping:
        raise ValueError(f"Unexpected MuRIL output label: {raw_label}")

    return {
        "sentiment": label_mapping[raw_label],
        "confidence": float(prediction["score"]),
        "model_name": MODEL_NAME,
        "analysis_method": "transformer",
    }


def predict_sentiment_batch(
    texts: list[str],
    batch_size: int = 8,
) -> list[dict[str, Any]]:
    """Predict sentiment for multiple reviews."""
    if not texts:
        return []

    if not 1 <= batch_size <= 64:
        raise ValueError("batch_size must be between 1 and 64.")

    for index, text in enumerate(texts):
        if not isinstance(text, str) or not text.strip():
            raise ValueError(
                f"Review at index {index} must be a non-empty string."
            )

    classifier, label_mapping = get_classifier()

    predictions = classifier(
        [text.strip() for text in texts],
        truncation=True,
        batch_size=batch_size,
    )

    results = []

    for prediction in predictions:
        raw_label = prediction["label"]

        if raw_label not in label_mapping:
            raise ValueError(f"Unexpected MuRIL output label: {raw_label}")

        results.append({
            "sentiment": label_mapping[raw_label],
            "confidence": float(prediction["score"]),
            "model_name": MODEL_NAME,
            "analysis_method": "transformer",
        })

    return results
