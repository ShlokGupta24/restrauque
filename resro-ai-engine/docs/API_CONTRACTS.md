
# Resro AI Engine — API Contracts

Base URL (local): http://127.0.0.1:8000

API version: v1

## 1. Rule-based review analysis

POST /api/v1/ai/reviews/analyze

Request:
{
  "text": "The food was excellent.",
  "rating": 5
}

Purpose:
Runs the existing rule-based review analysis service.

## 2. Review summary

POST /api/v1/ai/reviews/summary

Request:
{
  "reviews": [
    {"text": "Food was excellent.", "rating": 5},
    {"text": "Service was slow.", "rating": 2}
  ]
}

Purpose:
Summarizes a batch of reviews using the existing review intelligence service.

## 3. MuRIL single-review sentiment

POST /api/v1/ai/reviews/transformer/analyze

Request:
{
  "text": "Khana bahut accha tha.",
  "rating": 5
}

Example response:
{
  "review_text": "Khana bahut accha tha.",
  "rating": 5,
  "sentiment": "positive",
  "confidence": 0.95,
  "model_name": "airzipm/sentiment-analysis-muril-v2",
  "analysis_method": "transformer"
}

The confidence shown is illustrative, not a guaranteed output.

## 4. MuRIL batch sentiment

POST /api/v1/ai/reviews/transformer/analyze-batch

Request:
{
  "reviews": [
    {"text": "Food was delicious.", "rating": 5},
    {"text": "Service was slow.", "rating": 2}
  ]
}

Example response:
{
  "total_reviews": 2,
  "model_name": "airzipm/sentiment-analysis-muril-v2",
  "results": [
    {
      "review_text": "Food was delicious.",
      "rating": 5,
      "sentiment": "positive",
      "confidence": 0.95,
      "model_name": "airzipm/sentiment-analysis-muril-v2",
      "analysis_method": "transformer"
    },
    {
      "review_text": "Service was slow.",
      "rating": 2,
      "sentiment": "negative",
      "confidence": 0.91,
      "model_name": "airzipm/sentiment-analysis-muril-v2",
      "analysis_method": "transformer"
    }
  ]
}

Predictions and confidence values are illustrative.

## Validation

- text: required, 1–5000 characters
- rating: optional integer, 1–5
- reviews: required array, 1–500 items

Invalid requests return HTTP 422.

## Inference errors

The transformer endpoints return HTTP 503 if inference fails or
the batch result is incomplete.

Example:
{
  "detail": "Sentiment analysis is temporarily unavailable."
}

Clients should handle 503 responses gracefully and may retry
transient failures with bounded retries and backoff.

## Integration rules

- The AI service does not create or update orders, payments, or reviews.
- The core backend remains responsible for authentication and
  operational database writes.
- Synthetic datasets are for development and evaluation only.
- Do not send database credentials or other secrets in API payloads.
- Use the deployed AI service URL instead of localhost in production.
