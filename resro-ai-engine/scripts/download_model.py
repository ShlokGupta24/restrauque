
from pathlib import Path

from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models" / "muril-sentiment-v2"

MODEL_ID = "airzipm/sentiment-analysis-muril-v2"
MODEL_REVISION = "e3f3404276e85565d38649d5a4f35f58b1f255b7"


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Downloading {MODEL_ID}")
    print(f"Pinned revision: {MODEL_REVISION}")
    print(f"Destination: {MODEL_DIR}")

    snapshot_path = snapshot_download(
        repo_id=MODEL_ID,
        revision=MODEL_REVISION,
        local_dir=str(MODEL_DIR),
    )

    required_files = [
        "config.json",
        "model.safetensors",
    ]

    missing = [
        filename
        for filename in required_files
        if not (MODEL_DIR / filename).is_file()
    ]

    if missing:
        raise RuntimeError(
            f"Model download is incomplete. Missing files: {missing}"
        )

    tokenizer_files = [
        "tokenizer.json",
        "tokenizer_config.json",
        "spiece.model",
        "tokenizer.model",
        "vocab.txt",
    ]

    if not any(
        (MODEL_DIR / filename).is_file()
        for filename in tokenizer_files
    ):
        raise RuntimeError(
            "No recognized tokenizer files were found. "
            "Inspect the downloaded snapshot before continuing."
        )

    print(f"\nSnapshot downloaded to: {snapshot_path}")
    print("Required model and tokenizer files were found.")
    print("Next: validate inference using local files only.")


if __name__ == "__main__":
    main()

