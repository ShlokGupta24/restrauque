
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data" / "synthetic"

FILES = [
    "restaurants",
    "branches",
    "customers",
    "categories",
    "products",
    "orders",
    "order_items",
    "payments",
    "feedback",
]


def load_datasets():
    datasets = {}

    for name in FILES:
        path = DATA_DIR / f"{name}.csv"

        if not path.exists():
            raise FileNotFoundError(f"Missing dataset: {path}")

        datasets[name] = pd.read_csv(path)

    return datasets


def validate():
    data = load_datasets()
    errors = []
    checks = []

    def check(condition, message):
        if condition:
            checks.append(message)
        else:
            errors.append(message)

    # Required identifiers and uniqueness
    for name, frame in data.items():
        check(not frame.empty, f"{name}: dataset is not empty")

        if "id" in frame.columns:
            check(
                frame["id"].notna().all(),
                f"{name}: all IDs are present",
            )
            check(
                frame["id"].is_unique,
                f"{name}: IDs are unique",
            )

    restaurants = data["restaurants"]
    branches = data["branches"]
    customers = data["customers"]
    products = data["products"]
    orders = data["orders"]
    items = data["order_items"]
    payments = data["payments"]
    feedback = data["feedback"]

    restaurant_ids = set(restaurants["id"])
    branch_ids = set(branches["id"])
    customer_ids = set(customers["id"])
    product_ids = set(products["id"])
    order_ids = set(orders["id"])

    # Foreign-key-like relationship checks
    check(
        set(branches["restaurant_id"]) <= restaurant_ids,
        "Every branch belongs to an existing restaurant",
    )
    check(
        set(products["restaurant_id"]) <= restaurant_ids,
        "Every product belongs to an existing restaurant",
    )
    check(
        set(orders["restaurant_id"]) <= restaurant_ids,
        "Every order belongs to an existing restaurant",
    )
    check(
        set(orders["branch_id"]) <= branch_ids,
        "Every order references an existing branch",
    )
    check(
        set(orders["customer_id"]) <= customer_ids,
        "Every order references an existing customer",
    )
    check(
        set(items["order_id"]) <= order_ids,
        "Every order item references an existing order",
    )
    check(
        set(items["product_id"]) <= product_ids,
        "Every order item references an existing product",
    )
    check(
        set(payments["order_id"]) <= order_ids,
        "Every payment references an existing order",
    )
    check(
        set(feedback["order_id"]) <= order_ids,
        "Every feedback record references an existing order",
    )
    check(
        set(feedback["customer_id"]) <= customer_ids,
        "Every feedback record references an existing customer",
    )

    # Order calculations
    item_totals = items.groupby("order_id")["total_price"].sum()
    order_subtotals = orders.set_index("id")["subtotal"]

    calculated = item_totals.reindex(order_subtotals.index).fillna(0)

    check(
        bool(((calculated - order_subtotals).abs() < 0.02).all()),
        "Order subtotals match their item totals",
    )

    check(
        bool((items["quantity"] > 0).all()),
        "All item quantities are positive",
    )
    check(
        bool((items["unit_price"] >= 0).all()),
        "All item unit prices are non-negative",
    )
    check(
        bool((items["total_price"] >= 0).all()),
        "All item totals are non-negative",
    )
    check(
        bool((orders["total_amount"] >= 0).all()),
        "All order totals are non-negative",
    )

    # The generated fixture should have one payment per order.
    check(
        payments["order_id"].is_unique
        and len(payments) == len(orders),
        "Exactly one payment record exists per order",
    )

    print("\nRESRO SYNTHETIC DATA VALIDATION")
    print("=" * 42)

    for message in checks:
        print(f"PASS  {message}")

    for message in errors:
        print(f"FAIL  {message}")

    print(f"\nPassed: {len(checks)}")
    print(f"Failed: {len(errors)}")

    if errors:
        raise SystemExit(1)

    print("\nAll validation checks passed.")


if __name__ == "__main__":
    validate()
