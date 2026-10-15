
import json
import re
from pathlib import Path

import hashlib
import platform

import mlflow
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from transformers import pipeline


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "evaluation" / "hinglish_reviews.csv"
OUTPUT_DIR = ROOT / "reports" / "sentiment_evaluation"
TRACKING_DB = ROOT / "mlflow.db"

EXPERIMENT_NAME = "resro-sentiment-evaluation"
BATCH_SIZE = 8
LABELS = ["negative", "neutral", "positive"]

MODELS = {
    "MuRIL": "airzipm/sentiment-analysis-muril-v2",
}

MANUAL_LABEL_MAP = {
    # Add mappings here only if verified from the model config.
}


def normalize_label(label):
    label = str(label).strip().lower()

    aliases = {
        "positive": "positive",
        "pos": "positive",
        "negative": "negative",
        "neg": "negative",
        "neutral": "neutral",
        "neu": "neutral",
    }

    return aliases.get(label)


def get_label_mapping(classifier, model_key):
    configured = classifier.model.config.id2label
    manual = MANUAL_LABEL_MAP.get(model_key, {})
    mapping = {}

    for label_id, raw_label in configured.items():
        resolved = manual.get(str(raw_label))

        if resolved is None:
            resolved = normalize_label(raw_label)

        if resolved not in LABELS:
            raise ValueError(
                f"Cannot safely map {model_key} output label "
                f"{raw_label!r}. Model config: {configured}"
            )

        mapping[str(raw_label)] = resolved

    if set(mapping.values()) != set(LABELS):
        raise ValueError(
            f"{model_key} does not map to all three sentiment classes. "
            f"Resolved mapping: {mapping}"
        )

    return mapping


def load_dataset():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH, keep_default_na=False)

    required = {"text", "language"}
    missing = required - set(df.columns)

    if missing:
        raise ValueError(
            f"Dataset is missing columns: {sorted(missing)}"
        )

    adjudicated = (
        df["adjudicated_label"].astype(str).str.strip()
        if "adjudicated_label" in df.columns
        else pd.Series("", index=df.index)
    )

    original_gold = (
        df["gold_sentiment"].astype(str).str.strip()
        if "gold_sentiment" in df.columns
        else pd.Series("", index=df.index)
    )

    has_adjudicated = adjudicated != ""

    df["evaluation_label"] = adjudicated.where(
        has_adjudicated, original_gold
    ).str.lower()

    df["label_source"] = has_adjudicated.map(
        {True: "adjudicated_label", False: "gold_sentiment"}
    )

    df["text"] = df["text"].astype(str).str.strip()
    df["language"] = df["language"].astype(str).str.strip()

    df = df[
        (df["text"] != "")
        & (df["language"] != "")
        & df["evaluation_label"].isin(LABELS)
    ].copy()

    if df.empty:
        raise ValueError(
            "No labelled reviews found. Provide non-empty review text "
            "and valid sentiment labels."
        )

    print(f"Usable labelled reviews: {len(df)}")
    print("\nReviews by language:")
    print(df["language"].value_counts().to_string())

    print("\nEvaluation label distribution:")
    print(df["evaluation_label"].value_counts().to_string())

    return df


def identify_dataset_type(df):
    """Identify synthetic data without claiming human verification."""
    if (
        "source_type" in df.columns
        and df["source_type"].astype(str).str.contains(
            "synthetic", case=False
        ).all()
    ):
        return "synthetic_generated"

    if (
        "split" in df.columns
        and df["split"].astype(str).str.contains(
            "synthetic_only", case=False
        ).all()
    ):
        return "synthetic_only"

    return "unverified_or_mixed"


def safe_metric_suffix(value):
    value = re.sub(r"[^a-zA-Z0-9_]+", "_", str(value).lower())
    return value.strip("_") or "unknown"


def evaluate_model(model_key, model_name, df, dataset_type, dataset_hash):
    print(f"\n{'=' * 65}")
    print(f"Evaluating {model_key}: {model_name}")
    print("=" * 65)

    with mlflow.start_run(run_name=model_key):
        mlflow.set_tags({
            "model_family": "transformer",
            "task": "sentiment_analysis",
            "dataset_type": dataset_type,
            "evaluation_status": (
                "development_only"
                if dataset_type.startswith("synthetic")
                else "not_independently_verified"
            ),
        })

        mlflow.log_params({
            "model_key": model_key,
            "model_name": model_name,
            "dataset_name": DATASET_PATH.name,
            "dataset_rows": len(df),
            "batch_size": BATCH_SIZE,
            "label_source": "adjudicated_label_with_gold_fallback",
            "class_labels": ",".join(LABELS),
            "dataset_sha256": dataset_hash,
            "python_version": platform.python_version(),
            "mlflow_version": mlflow.__version__,
        })

        classifier = pipeline(
            "text-classification",
            model=model_name,
            tokenizer=model_name,
        )

        mapping = get_label_mapping(classifier, model_key)
        print("Verified label mapping:", mapping)

        predictions = classifier(
            df["text"].tolist(),
            truncation=True,
            batch_size=BATCH_SIZE,
        )

        predicted_labels = []
        prediction_scores = []

        for prediction in predictions:
            raw_label = prediction["label"]

            if raw_label not in mapping:
                raise ValueError(
                    f"Unexpected output label {raw_label!r} "
                    f"from {model_key}"
                )

            predicted_labels.append(mapping[raw_label])
            prediction_scores.append(float(prediction["score"]))

        results = df.copy()
        results["model"] = model_key
        results["predicted_sentiment"] = predicted_labels
        results["prediction_score"] = prediction_scores
        results["correct"] = (
            results["evaluation_label"]
            == results["predicted_sentiment"]
        )

        y_true = results["evaluation_label"]
        y_pred = results["predicted_sentiment"]

        metrics = {
            "accuracy": accuracy_score(y_true, y_pred),
            "precision_macro": precision_score(
                y_true, y_pred, labels=LABELS,
                average="macro", zero_division=0,
            ),
            "recall_macro": recall_score(
                y_true, y_pred, labels=LABELS,
                average="macro", zero_division=0,
            ),
            "f1_macro": f1_score(
                y_true, y_pred, labels=LABELS,
                average="macro", zero_division=0,
            ),
            "f1_weighted": f1_score(
                y_true, y_pred, labels=LABELS,
                average="weighted", zero_division=0,
            ),
        }

        mlflow.log_metrics(metrics)

        report = classification_report(
            y_true,
            y_pred,
            labels=LABELS,
            output_dict=True,
            zero_division=0,
        )

        for label in LABELS:
            for metric_name in ("precision", "recall", "f1-score"):
                mlflow.log_metric(
                    f"{label}_{metric_name.replace('-', '_')}",
                    report[label][metric_name],
                )

        print("\nEvaluation metrics:")
        for metric_name, value in metrics.items():
            print(f"{metric_name}: {value:.4f}")

        print("\nClassification report:")
        print(
            classification_report(
                y_true,
                y_pred,
                labels=LABELS,
                zero_division=0,
            )
        )

        # Track accuracy per language.
        language_accuracy = results.groupby("language")["correct"].mean()

        print("\nAccuracy by language:")
        print((language_accuracy * 100).round(2).astype(str).add("%").to_string())

        for language, accuracy in language_accuracy.items():
            suffix = safe_metric_suffix(language)
            mlflow.log_metric(f"accuracy_language_{suffix}", float(accuracy))

        # Save aggregate artifacts only. Do not upload review text.
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        matrix = pd.DataFrame(
            confusion_matrix(y_true, y_pred, labels=LABELS),
            index=LABELS,
            columns=LABELS,
        )
        matrix.index.name = "actual_sentiment"

        matrix_path = OUTPUT_DIR / f"{model_key}_confusion_matrix.csv"
        matrix.to_csv(matrix_path)
        mlflow.log_artifact(str(matrix_path), artifact_path="evaluation")

        report_path = OUTPUT_DIR / f"{model_key}_classification_report.json"
        report_path.write_text(
            json.dumps(report, indent=2),
            encoding="utf-8",
        )
        mlflow.log_artifact(str(report_path), artifact_path="evaluation")

        print("\nConfusion matrix (rows=actual, columns=predicted):")
        print(matrix)

        return results


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    tracking_uri = f"sqlite:///{TRACKING_DB.as_posix()}"
    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(EXPERIMENT_NAME)

    df = load_dataset()

    dataset_hash = hashlib.sha256(
    DATASET_PATH.read_bytes()
    ).hexdigest()

    dataset_type = identify_dataset_type(df)

    print(f"Dataset SHA-256: {dataset_hash}")
    print(f"Dataset type: {dataset_type}")
    

    print(f"\nDataset type: {dataset_type}")
    print(f"MLflow tracking database: {TRACKING_DB.resolve()}")

    all_results = []
    failures = {}

    for model_key, model_name in MODELS.items():
        try:
            results = evaluate_model(
                model_key,
                model_name,
                df,
                dataset_type,
                dataset_hash,
            )
            all_results.append(results)

        except Exception as exc:
            failures[model_key] = str(exc)
            print(f"\nCould not evaluate {model_key}: {exc}")

    if all_results:
        combined = pd.concat(all_results, ignore_index=True)
        output_path = OUTPUT_DIR / "predictions.csv"

        # Keep this local file for debugging. It contains review text,
        # so it is deliberately NOT logged as an MLflow artifact.
        combined.to_csv(output_path, index=False)
        print(f"\nSaved predictions to: {output_path}")

    if failures:
        failure_path = OUTPUT_DIR / "evaluation_errors.json"
        failure_path.write_text(
            json.dumps(failures, indent=2),
            encoding="utf-8",
        )
        print(f"Some evaluations need attention: {failure_path}")

    if not all_results:
        raise RuntimeError(
            "No model was evaluated successfully. Check the errors above."
        )

    print("\nMLflow experiment:", EXPERIMENT_NAME)
    print("Launch the MLflow UI to inspect this run.")


if __name__ == "__main__":
    main()
