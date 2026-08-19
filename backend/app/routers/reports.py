from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.report import (
    NetProfitStatementResponse, FastMovingProductItem, SalesReportSummaryResponse
)
from app.services import report as report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/net-profit", response_model=NetProfitStatementResponse)
def get_net_profit(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    return report_service.get_net_profit_statement(
        db, target_store_id, date_from=date_from, date_to=date_to
    )


@router.get("/fast-moving", response_model=List[FastMovingProductItem])
def get_fast_moving(
    days: int = 30,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    return report_service.get_fast_moving_products(
        db, target_store_id, days=days, limit=limit
    )


@router.get("/sales-summary", response_model=SalesReportSummaryResponse)
def get_sales_summary(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    return report_service.get_sales_report_summary(
        db, target_store_id, date_from=date_from, date_to=date_to
    )
