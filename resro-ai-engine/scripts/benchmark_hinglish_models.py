
import gc

import torch
from transformers import pipeline


MODELS = [
    "airzipm/sentiment-analysis-muril-v2",
    "shae2977/xlm-roberta-hinglish-sentiment-analysis",
]

TEST_REVIEWS = [
    {
        "text": "The coffee was amazing and the staff were friendly.",
        "expected": "positive",
        "language": "English",
    },
    {
        "text": "Coffee bahut mast thi, definitely coming back!",
        "expected": "positive",
        "language": "Romanized Hinglish",
    },
    {
        "text": "Khana thanda tha aur staff bhi rude tha.",
        "expected": "negative",
        "language": "Romanized Hinglish",
    },
    {
        "text": "कॉफी बहुत अच्छी थी और स्टाफ भी अच्छा था।",
        "expected": "positive",
        "language": "Hindi (Devanagari)",
    },
    {
        "text": "Food acha tha but service bahut slow thi.",
        "expected": "mixed",
        "language": "Mixed sentiment",
    },
    {
        "text": "Theek tha, kuch special nahi.",
        "expected": "neutral",
        "language": "Romanized Hinglish",
    },
    {
        "text": "Paisa vasool experience, ambience bhi mast hai.",
        "expected": "positive",
        "language": "Romanized Hinglish",
    },
    {
        "text": "Taste accha tha but price bahut zyada hai.",
        "expected": "mixed",
        "language": "Mixed sentiment",
    },
]


def normalize_label(label: str, model_name: str) -> str:
    label = label.lower().strip()

    if label in {"positive", "negative", "neutral"}:
        return label

    # These two model cards document the same class ordering.
    label_map = {
        "label_0": "negative",
        "label_1": "neutral",
        "label_2": "positive",
    }

    if label in label_map:
        return label_map[label]

    raise ValueError(
        f"Unknown label {label!r} from {model_name}. "
        "Inspect the model's config.id2label before proceeding."
    )


def main():
    device = 0 if torch.cuda.is_available() else -1

    print(f"Device: {'CUDA GPU' if device == 0 else 'CPU'}")
    print("Mixed reviews are not a fourth class in these models.")
    print("Their 'expected' labels are review-level test expectations.\n")

    for model_name in MODELS:
        print("=" * 78)
        print(f"MODEL: {model_name}")

        classifier = pipeline(
            task="text-classification",
            model=model_name,
            device=device,
        )

        for review in TEST_REVIEWS:
            result = classifier(
                review["text"],
                truncation=True,
                max_length=128,
            )[0]

            sentiment = normalize_label(
                result["label"],
                model_name,
            )

            print(f"\nText:      {review['text']}")
            print(f"Language:  {review['language']}")
            print(f"Expected:  {review['expected']}")
            print(f"Predicted: {sentiment}")
            print(f"Score:     {result['score']:.4f}")

        del classifier
        gc.collect()

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        print()


if __name__ == "__main__":
    main()
