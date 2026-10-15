
import csv
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "data" / "evaluation"
OUTPUT_FILE = OUTPUT_DIR / "hinglish_reviews.csv"

# These are collection quotas, not assigned ground-truth labels.
QUOTAS = {
    "English": {
        "positive": 56,
        "neutral": 56,
        "negative": 55,
    },
    "Romanized Hinglish": {
        "positive": 56,
        "neutral": 55,
        "negative": 56,
    },
    "Devanagari Hindi": {
        "positive": 55,
        "neutral": 56,
        "negative": 55,
    },
}

FIELDS = [
    "review_id",
    "text",
    "language",
    "gold_sentiment",
    "is_mixed",
    "sampling_target",
    "source_type",
    "source_reference",
    "annotator_1_label",
    "annotator_2_label",
    "adjudicated_label",
    "split",
]


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if OUTPUT_FILE.exists():
        raise FileExistsError(
            f"{OUTPUT_FILE} already exists. "
            "Refusing to overwrite your annotation work."
        )

    rows = []
    review_number = 1

    for language, sentiment_quotas in QUOTAS.items():
        for target_sentiment, count in sentiment_quotas.items():
            for _ in range(count):
                rows.append({
                    "review_id": f"REV-{review_number:04d}",
                    "text": "",
                    "language": language,
                    "gold_sentiment": "",
                    "is_mixed": "",
                    "sampling_target": target_sentiment,
                    "source_type": "",
                    "source_reference": "",
                    "annotator_1_label": "",
                    "annotator_2_label": "",
                    "adjudicated_label": "",
                    "split": "",
                })
                review_number += 1

    assert len(rows) == 500

    with OUTPUT_FILE.open(
        "w",
        newline="",
        encoding="utf-8-sig",
    ) as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Created: {OUTPUT_FILE}")
    print(f"Review slots: {len(rows)}")
    print("\nLanguage quotas:")

    for language, quotas in QUOTAS.items():
        print(f"  {language}: {sum(quotas.values())}")

    print("\nSampling quotas:")
    for sentiment in ["positive", "neutral", "negative"]:
        total = sum(
            quotas[sentiment]
            for quotas in QUOTAS.values()
        )
        print(f"  {sentiment}: {total}")

    print(
        "\nTemplate created. "
        "Review text and gold labels still need annotation."
    )


if __name__ == "__main__":
    main()
