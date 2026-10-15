
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import require_service_token

from app.core.config import settings
from app.ml.muril_sentiment import (
    predict_sentiment,
    predict_sentiment_batch,
)
from app.schemas.reviews import ReviewBatchInput, ReviewInput
from app.services.review_intelligence import (
    analyze_review,
    summarize_reviews,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ai/reviews",
    tags=["AI - Review Intelligence"],
    dependencies=[Depends(require_service_token)],
)


@router.post("/analyze")
def analyze_single_review(review: ReviewInput):
    return analyze_review(
        review_text=review.text,
        rating=review.rating,
    )


@router.post("/summary")
def summarize_review_batch(payload: ReviewBatchInput):
    reviews = [review.model_dump() for review in payload.reviews]
    return summarize_reviews(reviews)


@router.post("/transformer/analyze")
def analyze_review_with_muril(payload: ReviewInput):
    """Analyze one review using the MuRIL transformer."""
    try:
        result = predict_sentiment(payload.text)
    except Exception as exc:
        logger.exception("MuRIL single-review inference failed")
        raise HTTPException(
            status_code=503,
            detail="Sentiment analysis is temporarily unavailable.",
        ) from exc

    return {
        "review_text": payload.text,
        "rating": payload.rating,
        **result,
    }


@router.post("/transformer/analyze-batch")
def analyze_reviews_with_muril(payload: ReviewBatchInput):
    """Analyze multiple reviews using MuRIL batch inference."""
    texts = [review.text for review in payload.reviews]

    try:
        predictions = predict_sentiment_batch(texts)
    except Exception as exc:
        logger.exception("MuRIL batch inference failed")
        raise HTTPException(
            status_code=503,
            detail="Sentiment analysis is temporarily unavailable.",
        ) from exc

    if len(predictions) != len(payload.reviews):
        logger.error(
            "MuRIL prediction count mismatch: received %s predictions "
            "for %s reviews",
            len(predictions),
            len(payload.reviews),
        )
        raise HTTPException(
            status_code=503,
            detail="Sentiment analysis returned an incomplete result.",
        )

    results = [
        {
            "review_text": review.text,
            "rating": review.rating,
            **prediction,
        }
        for review, prediction in zip(payload.reviews, predictions)
    ]

    return {
        "total_reviews": len(results),
        "model_name": settings.MURIL_MODEL_NAME,
        "results": results,
    }
