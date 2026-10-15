
from pathlib import Path
import sys

# Make the project root importable when running this script directly.
PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.synthetic_data import generate_synthetic_dataset


def main():
    output_dir = PROJECT_ROOT / "data" / "synthetic"
    output_dir.mkdir(parents=True, exist_ok=True)

    datasets = generate_synthetic_dataset(
        seed=42,
        days=90,
        n_customers=120,
        n_orders=500,
    )

    print("\nResro Synthetic Data Generator")
    print("-" * 38)

    for table_name, dataframe in datasets.items():
        output_path = output_dir / f"{table_name}.csv"
        dataframe.to_csv(output_path, index=False)

        print(
            f"{table_name:<18} "
            f"{len(dataframe):>5} rows  ->  "
            f"{output_path.relative_to(PROJECT_ROOT)}"
        )

    print("\nGeneration complete.")
    print("These files are local CSVs; Neon was not modified.")


if __name__ == "__main__":
    main()
