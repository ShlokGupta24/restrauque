
import re
from collections import Counter
from typing import Any


# Small, transparent vocabulary for the first baseline.
# We will replace or benchmark this against a trained model later.
POSITIVE_WORDS = {
    "amazing", "awesome", "best", "delicious", "excellent",
    "friendly", "fresh", "good", "great", "love", "loved",
    "perfect", "tasty", "wonderful", "helpful", "quick",
    "clean", "comfortable", "affordable",
}

NEGATIVE_WORDS = {
    "awful", "bad", "bland", "cold", "costly", "dirty",
    "disappointing", "disappointed", "expensive", "horrible",
    "late", "overpriced", "poor", "rude", "slow", "stale",
    "terrible", "unfriendly", "worst", "waited", "waiting",
}

NEGATIONS = {"not", "no", "never", "hardly", "isn't", "wasn't"}

ASPECT_KEYWORDS = {
    "food": {
        "food", "taste", "tasty", "delicious", "flavour",
        "flavor", "meal", "dish", "pizza", "coffee", "burger",
        "sandwich", "fresh", "bland", "stale", "cold",
    },
    "service": {
        "service", "staff", "waiter", "waitress", "employee",
        "friendly", "rude", "helpful", "unfriendly",
    },
    "price": {
        "price", "prices", "cost", "costly", "expensive",
        "overpriced", "affordable", "value", "cheap",
    },
    "ambience": {
        "ambience", "ambiance", "atmosphere", "music",
        "interior", "seating", "comfortable", "noisy", "clean",
        "dirty",
    },
    "waiting_time": {
        "wait", "waited", "waiting", "delay", "delayed",
        "slow", "quick", "late", "time",
    },
}


def _tokenize(text: str) -> list[str]:
    """Normalize text into simple word tokens."""
    return re.findall(r"[a-z']+", text.lower())


def _sentiment_score(tokens: list[str]) -> int:
    """Count positive/negative terms with a basic negation rule."""
    score = 0

    for index, token in enumerate(tokens):
        value = 0

        if token in POSITIVE_WORDS:
            value = 1
        elif token in NEGATIVE_WORDS:
            value = -1

        if value == 0:
            continue

        # Reverse the polarity when a negation appears nearby.
        previous_tokens = tokens[max(0, index - 3):index]
        if any(word in NEGATIONS for word in previous_tokens):
            value *= -1

        score += value

    return score


def analyze_review(
    review_text: str,
    rating: int | None = None,
) -> dict[str, Any]:
    """
    Analyze one review with a rule-based baseline.

    The rating is returned as metadata; it does not determine
    the predicted sentiment.
    """
    text = review_text.strip()
    tokens = _tokenize(text)

    score = _sentiment_score(tokens)

    if score > 0:
        sentiment = "positive"
    elif score < 0:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    # This is a heuristic confidence indicator, not a calibrated
    # probability from a trained classifier.
    confidence = (
        round(abs(score) / (abs(score) + 2), 3)
        if score != 0
        else 0.0
    )

    token_set = set(tokens)
    aspects = [
        aspect
        for aspect, keywords in ASPECT_KEYWORDS.items()
        if token_set.intersection(keywords)
    ]

    return {
        "review_text": text,
        "rating": rating,
        "sentiment": sentiment,
        "sentiment_score": score,
        "confidence": confidence,
        "aspects": aspects,
        "analysis_method": "rule_based_baseline",
    }


def summarize_reviews(
    reviews: list[dict[str, Any]],
) -> dict[str, Any]:
    """Summarize reviews using the same baseline analyzer."""
    analyzed = [
        analyze_review(
            review_text=review["text"],
            rating=review.get("rating"),
        )
        for review in reviews
    ]

    sentiment_counts = Counter(
        item["sentiment"] for item in analyzed
    )

    aspect_counts = Counter(
        aspect
        for item in analyzed
        for aspect in item["aspects"]
    )

    rated_reviews = [
        item["rating"]
        for item in analyzed
        if item["rating"] is not None
    ]

    total = len(analyzed)

    return {
        "analysis_method": "rule_based_baseline",
        "total_reviews": total,
        "sentiment_counts": {
            sentiment: sentiment_counts.get(sentiment, 0)
            for sentiment in ["positive", "neutral", "negative"]
        },
        "sentiment_percentages": {
            sentiment: round(
                sentiment_counts.get(sentiment, 0) / total * 100,
                2,
            ) if total else 0.0
            for sentiment in ["positive", "neutral", "negative"]
        },
        "average_rating": (
            round(sum(rated_reviews) / len(rated_reviews), 2)
            if rated_reviews
            else None
        ),
        "aspect_mentions": dict(
            sorted(
                aspect_counts.items(),
                key=lambda item: item[1],
                reverse=True,
            )
        ),
        "reviews": analyzed,
    }
