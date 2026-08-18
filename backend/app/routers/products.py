from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.product import CategoryCreate, CategoryResponse, ProductCreate, ProductUpdate, ProductResponse
from app.services import product as product_service
from app.dependencies import get_current_user, require_owner
from app.models.user import User

categories_router = APIRouter(prefix="/categories", tags=["categories"])
products_router = APIRouter(prefix="/products", tags=["products"])


# =========================================================================
# Categories Endpoints
# =========================================================================

@categories_router.get("/", response_model=List[CategoryResponse])
def get_categories(
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    categories = product_service.list_categories(db, target_store_id)
    return [CategoryResponse.model_validate(c) for c in categories]


@categories_router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def post_category(
    category_in: CategoryCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    target_store_id = store_id or current_user.store_id or 1
    category = product_service.create_category(db, target_store_id, category_in)
    return CategoryResponse.model_validate(category)


@categories_router.delete("/{category_id}")
def delete_category(
    category_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    target_store_id = store_id or current_user.store_id or 1
    product_service.delete_category(db, target_store_id, category_id)
    return {"message": "Category deleted"}


# =========================================================================
# Products Endpoints
# =========================================================================

@products_router.get("/", response_model=List[ProductResponse])
def get_products(
    q: Optional[str] = None,
    category_id: Optional[int] = None,
    low_stock_only: bool = False,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    results = product_service.list_products(
        db,
        store_id=target_store_id,
        query_str=q,
        category_id=category_id,
        low_stock_only=low_stock_only
    )
    
    responses = []
    for prod, qty, formatted, is_low in results:
        res = ProductResponse.model_validate(prod)
        res.current_stock = qty
        res.formatted_stock = formatted
        res.is_low_stock = is_low
        responses.append(res)
    return responses


@products_router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def post_product(
    product_in: ProductCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    target_store_id = store_id or current_user.store_id or 1
    prod, qty, formatted, is_low = product_service.create_product(
        db,
        store_id=target_store_id,
        user_id=current_user.id,
        product_in=product_in
    )
    res = ProductResponse.model_validate(prod)
    res.current_stock = qty
    res.formatted_stock = formatted
    res.is_low_stock = is_low
    return res


@products_router.get("/{product_id}", response_model=ProductResponse)
def get_product_by_id(
    product_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    prod, qty, formatted, is_low = product_service.get_product(db, target_store_id, product_id)
    res = ProductResponse.model_validate(prod)
    res.current_stock = qty
    res.formatted_stock = formatted
    res.is_low_stock = is_low
    return res


@products_router.patch("/{product_id}", response_model=ProductResponse)
def patch_product(
    product_id: int,
    product_in: ProductUpdate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    target_store_id = store_id or current_user.store_id or 1
    prod, qty, formatted, is_low = product_service.update_product(
        db,
        store_id=target_store_id,
        product_id=product_id,
        product_in=product_in
    )
    res = ProductResponse.model_validate(prod)
    res.current_stock = qty
    res.formatted_stock = formatted
    res.is_low_stock = is_low
    return res


@products_router.delete("/{product_id}")
def delete_product(
    product_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    target_store_id = store_id or current_user.store_id or 1
    product_service.delete_product(db, target_store_id, product_id)
    return {"message": "Product deactivated"}
