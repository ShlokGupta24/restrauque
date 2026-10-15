
from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data" / "synthetic"

COMPLETED_STATUS = "completed"
CANCELLED_STATUS = "cancelled"


def load_data() -> dict[str, pd.DataFrame]:
    """Load the local synthetic datasets; never connects to Neon."""
    names = [
        "orders",
        "order_items",
        "payments",
        "products",
        "feedback",
    ]

    data = {
        name: pd.read_csv(DATA_DIR / f"{name}.csv")
        for name in names
    }

    for column in ["ordered_at", "completed_at"]:
        data["orders"][column] = pd.to_datetime(
            data["orders"][column],
            utc=True,
            errors="coerce",
        )

    data["feedback"]["submitted_at"] = pd.to_datetime(
        data["feedback"]["submitted_at"],
        utc=True,
        errors="coerce",
    )

    return data


def filter_orders(
    orders: pd.DataFrame,
    start_date=None,
    end_date=None,
    branch_id: str | None = None,
) -> pd.DataFrame:
    """Filter by calendar dates in UTC and optionally by branch."""
    result = orders.copy()

    if start_date is not None:
        start = pd.Timestamp(start_date).tz_localize("UTC")
        result = result[result["ordered_at"] >= start]

    if end_date is not None:
        # Exclusive upper bound includes the entire end date.
        end_exclusive = (
            pd.Timestamp(end_date) + pd.Timedelta(days=1)
        ).tz_localize("UTC")

        result = result[result["ordered_at"] < end_exclusive]

    if branch_id:
        result = result[result["branch_id"] == branch_id]

    return result


def get_overview(
    start_date=None,
    end_date=None,
    branch_id: str | None = None,
) -> dict:
    data = load_data()

    orders = filter_orders(
        data["orders"],
        start_date,
        end_date,
        branch_id,
    )

    completed = orders[orders["status"] == COMPLETED_STATUS]

    revenue = float(completed["total_amount"].sum())
    completed_count = len(completed)

    payments = data["payments"][
        data["payments"]["order_id"].isin(orders["id"])
    ]

    feedback = data["feedback"][
        data["feedback"]["order_id"].isin(orders["id"])
    ]

    return {
        "data_source": "synthetic_csv",
        "currency": "INR",
        "total_orders": int(len(orders)),
        "completed_orders": int(completed_count),
        "cancelled_orders": int(
            (orders["status"] == CANCELLED_STATUS).sum()
        ),
        "pending_orders": int(
            (orders["status"] == "pending").sum()
        ),
        "revenue": round(revenue, 2),
        "average_order_value": round(
            revenue / completed_count if completed_count else 0,
            2,
        ),
        "payment_records": int(len(payments)),
        "paid_payments": int((payments["status"] == "paid").sum()),
        "feedback_count": int(len(feedback)),
        "average_feedback_rating": (
            round(float(feedback["rating"].mean()), 2)
            if not feedback.empty
            else None
        ),
    }


def get_sales_trend(
    start_date=None,
    end_date=None,
    branch_id: str | None = None,
) -> dict:
    data = load_data()

    orders = filter_orders(
        data["orders"],
        start_date,
        end_date,
        branch_id,
    )

    if orders.empty:
        return {"data_source": "synthetic_csv", "items": []}

    orders["date"] = orders["ordered_at"].dt.strftime("%Y-%m-%d")

    orders["recognized_revenue"] = orders["total_amount"].where(
        orders["status"] == COMPLETED_STATUS,
        0,
    )

    daily = (
        orders.groupby("date", as_index=False)
        .agg(
            order_count=("id", "count"),
            completed_orders=(
                "status",
                lambda s: int((s == COMPLETED_STATUS).sum()),
            ),
            revenue=("recognized_revenue", "sum"),
        )
        .sort_values("date")
    )

    return {
        "data_source": "synthetic_csv",
        "items": [
            {
                "date": row["date"],
                "order_count": int(row["order_count"]),
                "completed_orders": int(row["completed_orders"]),
                "revenue": round(float(row["revenue"]), 2),
            }
            for _, row in daily.iterrows()
        ],
    }


def get_top_products(
    start_date=None,
    end_date=None,
    branch_id: str | None = None,
    limit: int = 10,
) -> dict:
    data = load_data()

    orders = filter_orders(
        data["orders"],
        start_date,
        end_date,
        branch_id,
    )

    completed_ids = set(
        orders.loc[
            orders["status"] == COMPLETED_STATUS, "id"
        ]
    )

    items = data["order_items"]
    items = items[items["order_id"].isin(completed_ids)]

    if items.empty:
        return {"data_source": "synthetic_csv", "items": []}

    summary = (
        items.groupby("product_id", as_index=False)
        .agg(
            product_name=("product_name", "first"),
            quantity_sold=("quantity", "sum"),
            revenue=("total_price", "sum"),
        )
        .sort_values(
            ["quantity_sold", "revenue"],
            ascending=[False, False],
        )
        .head(limit)
    )

    return {
        "data_source": "synthetic_csv",
        "items": [
            {
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "quantity_sold": int(row["quantity_sold"]),
                "revenue": round(float(row["revenue"]), 2),
            }
            for _, row in summary.iterrows()
        ],
    }
