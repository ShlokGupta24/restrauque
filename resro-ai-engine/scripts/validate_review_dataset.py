
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "evaluation" / "hinglish_reviews.csv"

ALLOWED_LANGUAGES = {
    "English",
    "Romanized Hinglish",
    "Devanagari Hindi",
}

ALLOWED_SENTIMENTS = {
    "positive",
    "neutral",
    "negative",
}

REQUIRED_COLUMNS = {
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
}


def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {CSV_PATH}"
        )

    df = pd.read_csv(CSV_PATH, dtype=str).fillna("")

    missing_columns = REQUIRED_COLUMNS - set(df.columns)

    if missing_columns:
        raise ValueError(
            f"Missing columns: {sorted(missing_columns)}"
        )

    errors = []
    warnings = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    check(len(df) == 500, f"Expected 500 rows, got {len(df)}")
    check(
        df["review_id"].is_unique,
        "review_id values must be unique",
    )
    check(
        df["review_id"].str.strip().ne("").all(),
        "review_id cannot be empty",
    )
    check(
        df["language"].isin(ALLOWED_LANGUAGES).all(),
        "One or more language labels are invalid",
    )
    check(
        df["sampling_target"].isin(ALLOWED_SENTIMENTS).all(),
        "One or more sampling targets are invalid",
    )

    # Template validation: text and gold labels are expected
    # to be incomplete until annotation has been performed.
    empty_text = df["text"].str.strip().eq("").sum()
    empty_gold = df["gold_sentiment"].str.strip().eq("").sum()

    if empty_text:
        warnings.append(
            f"{empty_text} reviews still need review text"
        )

    if empty_gold:
        warnings.append(
            f"{empty_gold} reviews still need final sentiment labels"
        )

    nonempty_gold = df["gold_sentiment"].str.strip().ne("")
    check(
        df.loc[nonempty_gold, "gold_sentiment"]
        .isin(ALLOWED_SENTIMENTS).all(),
        "Invalid gold_sentiment values found",
    )

    nonempty_mixed = df["is_mixed"].str.strip().ne("")
    check(
        df.loc[nonempty_mixed, "is_mixed"]
        .str.lower()
        .isin({"true", "false"}).all(),
        "is_mixed must be true or false when supplied",
    )

    # Check quotas based on sampling targets, not actual sentiment.
    language_counts = df["language"].value_counts().to_dict()
    target_counts = df["sampling_target"].value_counts().to_dict()

    expected_languages = {
        "English": 167,
        "Romanized Hinglish": 167,
        "Devanagari Hindi": 166,
    }

    expected_targets = {
        "positive": 167,
        "neutral": 167,
        "negative": 166,
    }

    check(
        language_counts == expected_languages,
        f"Language quotas differ from target: {language_counts}",
    )
    check(
        target_counts == expected_targets,
        f"Sampling targets differ from target: {target_counts}",
    )

    # Duplicate text may be legitimate, so flag it for investigation.
    populated = df[df["text"].str.strip().ne("")].copy()
    normalized = populated["text"].str.lower().str.strip()
    duplicate_count = int(normalized.duplicated(keep=False).sum())

    if duplicate_count:
        warnings.append(
            f"{duplicate_count} rows have duplicate normalized text"
        )

    print("\nRESRO REVIEW DATASET VALIDATION")
    print("=" * 42)
    print(f"Rows: {len(df)}")
    print(f"Unique IDs: {df['review_id'].nunique()}")
    print(f"Reviews with text: {(df['text'].str.strip() != '').sum()}")
    print(f"Reviews with final labels: {nonempty_gold.sum()}")

    print("\nLanguage distribution:")
    print(df["language"].value_counts().to_string())

    print("\nSampling target distribution:")
    print(df["sampling_target"].value_counts().to_string())

    for warning in warnings:
        print(f"WARNING: {warning}")

    for error in errors:
        print(f"ERROR: {error}")

    if errors:
        raise SystemExit(1)

    print("\nStructural checks passed.")
    if warnings:
        print("The dataset still needs collection/annotation.")
    else:
        print("No warnings.")


if __name__ == "__main__":
    main()
