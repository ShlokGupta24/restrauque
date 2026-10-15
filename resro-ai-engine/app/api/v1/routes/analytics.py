
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.services.analytics import (
    get_overview,
    get_sales_trend,
    get_top_products,
)

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


def validate_dates(start_date, end_date):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="start_date must be on or before end_date",
        )


@router.get("/overview")
def analytics_overview(
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: str | None = None,
):
    validate_dates(start_date, end_date)

    return get_overview(
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
    )


@router.get("/sales-trend")
def analytics_sales_trend(
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: str | None = None,
):
    validate_dates(start_date, end_date)

    return get_sales_trend(
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
    )


@router.get("/top-products")
def analytics_top_products(
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: str | None = None,
    limit: int = Query(default=10, ge=1, le=50),
):
    validate_dates(start_date, end_date)

    return get_top_products(
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        limit=limit,
    )
