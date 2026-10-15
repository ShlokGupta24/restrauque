
from __future__ import annotations

from uuid import uuid4

import numpy as np
import pandas as pd


def generate_synthetic_dataset(
    seed: int = 42,
    days: int = 90,
    n_customers: int = 120,
    n_orders: int = 500,
) -> dict[str, pd.DataFrame]:
    """Generate repeatable synthetic restaurant data in memory."""

    rng = np.random.default_rng(seed)
    now = pd.Timestamp.now(tz="UTC").floor("s")
    start = now - pd.Timedelta(days=days)

    def new_id() -> str:
        return str(uuid4())

    def random_timestamp() -> pd.Timestamp:
        seconds = rng.uniform(0, days * 24 * 60 * 60)
        return start + pd.Timedelta(seconds=seconds)

    # Restaurant
    restaurant_id = new_id()
    restaurants = pd.DataFrame([{
        "id": restaurant_id,
        "name": "Resro Demo Cafe",
        "legal_name": "Resro Demo Cafe Pvt Ltd",
        "email": "demo@example.invalid",
        "phone": "SYNTHETIC-RESTAURANT",
        "address": "Synthetic Demo Address",
        "city": "Lucknow",
        "state": "Uttar Pradesh",
        "country": "India",
        "timezone": "Asia/Kolkata",
        "status": "active",
        "created_at": start,
        "updated_at": now,
    }])

    # Branches
    branches = pd.DataFrame([
        {
            "id": new_id(),
            "restaurant_id": restaurant_id,
            "name": name,
            "address": f"Synthetic Address {i + 1}",
            "city": "Lucknow",
            "state": "Uttar Pradesh",
            "country": "India",
            "phone": f"SYNTHETIC-BRANCH-{i + 1}",
            "timezone": "Asia/Kolkata",
            "status": "active",
            "created_at": start,
            "updated_at": now,
        }
        for i, name in enumerate([
            "Hazratganj Branch",
            "Gomti Nagar Branch",
            "Aliganj Branch",
        ])
    ])

    branch_ids = branches["id"].tolist()

    # Customers: deliberately fake names and contact details
    customers = pd.DataFrame([
        {
            "id": new_id(),
            "name": f"Demo Customer {i + 1:03d}",
            "phone": f"SYNTHETIC-CUSTOMER-{i + 1:03d}",
            "status": "active",
            "first_visit_at": None,
            "last_visit_at": None,
            "created_at": start,
            "updated_at": now,
        }
        for i in range(n_customers)
    ])

    customer_ids = customers["id"].tolist()

    # Products
    product_specs = [
        ("Cappuccino", 149, "Coffee"),
        ("Latte", 159, "Coffee"),
        ("Americano", 119, "Coffee"),
        ("Cold Coffee", 189, "Beverages"),
        ("Masala Chai", 79, "Tea"),
        ("Green Tea", 89, "Tea"),
        ("Veg Sandwich", 169, "Snacks"),
        ("Grilled Cheese Sandwich", 199, "Snacks"),
        ("French Fries", 129, "Snacks"),
        ("Paneer Wrap", 219, "Meals"),
        ("Veg Burger", 189, "Meals"),
        ("Margherita Pizza", 249, "Meals"),
        ("Chocolate Brownie", 139, "Desserts"),
        ("Cheesecake", 179, "Desserts"),
        ("Blueberry Muffin", 99, "Bakery"),
        ("Chocolate Muffin", 99, "Bakery"),
        ("Lemon Soda", 89, "Beverages"),
        ("Iced Tea", 109, "Beverages"),
    ]

    category_ids = {
        category: new_id()
        for _, _, category in product_specs
    }

    categories = pd.DataFrame([
        {
            "id": category_id,
            "restaurant_id": restaurant_id,
            "name": category,
        }
        for category, category_id in category_ids.items()
    ])

    products = pd.DataFrame([
        {
            "id": new_id(),
            "restaurant_id": restaurant_id,
            "category_id": category_ids[category],
            "name": name,
            "description": f"Synthetic demo product: {name}",
            "price": price,
            "image_url": None,
            "display_order": i + 1,
            "is_available": True,
            "is_active": True,
            "created_at": start,
            "updated_at": now,
        }
        for i, (name, price, category) in enumerate(product_specs)
    ])

    product_lookup = products.set_index("id").to_dict("index")
    product_ids = products["id"].tolist()

    # Orders, items and payments
    order_rows = []
    item_rows = []
    payment_rows = []

    order_statuses = ["completed", "cancelled", "pending"]
    order_weights = [0.82, 0.10, 0.08]

    payment_methods = ["upi", "card", "cash"]
    payment_weights = [0.60, 0.25, 0.15]

    for order_index in range(n_orders):
        order_id = new_id()
        ordered_at = random_timestamp()
        customer_id = rng.choice(customer_ids)
        branch_id = rng.choice(branch_ids)

        status = str(rng.choice(
            order_statuses,
            p=order_weights,
        ))

        # One to four distinct products per order
        item_count = int(rng.integers(1, 5))
        chosen_products = rng.choice(
            product_ids,
            size=item_count,
            replace=False,
        )

        subtotal = 0.0

        for product_id in chosen_products:
            product = product_lookup[product_id]
            quantity = int(rng.integers(1, 4))
            unit_price = float(product["price"])
            line_total = round(quantity * unit_price, 2)
            subtotal += line_total

            item_rows.append({
                "id": new_id(),
                "order_id": order_id,
                "product_id": product_id,
                "variant_id": None,
                "product_name": product["name"],
                "variant_name": None,
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": line_total,
                "special_instructions": None,
                "created_at": ordered_at,
            })

        subtotal = round(subtotal, 2)
        discount = round(
            subtotal * float(rng.choice([0.0, 0.0, 0.05, 0.10])),
            2,
        )
        tax = round((subtotal - discount) * 0.05, 2)
        total = round(subtotal - discount + tax, 2)

        completed_at = (
            ordered_at + pd.Timedelta(minutes=int(rng.integers(5, 75)))
            if status == "completed"
            else None
        )

        order_rows.append({
            "id": order_id,
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
            "table_id": None,
            "customer_id": customer_id,
            "order_number": f"DEMO-{order_index + 1:05d}",
            "order_type": str(rng.choice(["dine_in", "takeaway", "qr"])),
            "status": status,
            "subtotal": subtotal,
            "discount_amount": discount,
            "tax_amount": tax,
            "total_amount": total,
            "notes": None,
            "ordered_at": ordered_at,
            "completed_at": completed_at,
            "created_at": ordered_at,
            "updated_at": now,
        })

        payment_status = {
            "completed": "paid",
            "cancelled": "failed",
            "pending": "pending",
        }[status]

        payment_rows.append({
            "id": new_id(),
            "order_id": order_id,
            "amount": total,
            "payment_method": str(rng.choice(
                payment_methods,
                p=payment_weights,
            )),
            "status": payment_status,
            "transaction_reference": f"DEMO-TXN-{order_index + 1:05d}",
            "paid_at": completed_at if status == "completed" else None,
            "created_at": ordered_at,
            "updated_at": now,
        })

    orders = pd.DataFrame(order_rows)
    order_items = pd.DataFrame(item_rows)
    payments = pd.DataFrame(payment_rows)

    # Derive customer visit timestamps from generated orders
    completed_orders = orders[orders["status"] == "completed"]

    if not completed_orders.empty:
        visits = completed_orders.groupby("customer_id")["ordered_at"].agg(
            ["min", "max"]
        )

        customers["first_visit_at"] = customers["id"].map(visits["min"])
        customers["last_visit_at"] = customers["id"].map(visits["max"])

    # Feedback from a subset of completed orders
    feedback_rows = []
    completed_order_rows = completed_orders.to_dict("records")

    comment_options = [
        (5, "Loved the food and service."),
        (5, "Great experience. Will visit again."),
        (4, "Good food and friendly staff."),
        (4, "Nice atmosphere and tasty coffee."),
        (3, "Food was okay, service could improve."),
        (2, "The order took longer than expected."),
        (1, "The experience did not meet expectations."),
    ]

    for order in completed_order_rows:
        if rng.random() >= 0.30:
            continue

        rating, comment = comment_options[
            int(rng.integers(0, len(comment_options)))
        ]

        feedback_rows.append({
            "id": new_id(),
            "restaurant_id": restaurant_id,
            "branch_id": order["branch_id"],
            "order_id": order["id"],
            "customer_id": order["customer_id"],
            "rating": rating,
            "comment": comment,
            "feedback_type": "order",
            "status": "published",
            "submitted_at": order["completed_at"],
            "created_at": order["completed_at"],
            "updated_at": now,
        })

    feedback = pd.DataFrame(feedback_rows)

    return {
        "restaurants": restaurants,
        "branches": branches,
        "customers": customers,
        "categories": categories,
        "products": products,
        "orders": orders,
        "order_items": order_items,
        "payments": payments,
        "feedback": feedback,
    }
