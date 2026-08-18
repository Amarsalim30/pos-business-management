from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.models.user import User
from app.models.store import Store, RecurringExpense
from app.core.security import get_password_hash
from app.routers import auth, users, stores, health, products, inventory, sales, pre_sales, customers


def init_first_store_and_owner():
    """Seed initial store and owner user if the database is empty."""
    db: Session = SessionLocal()
    try:
        store = db.query(Store).first()
        if not store:
            store = Store(
                name=settings.FIRST_STORE_NAME,
                address="Nairobi, Kenya",
                phone="+254700000000",
                tax_id="P000000000X",
                vat_rate=0.1600,
                is_active=True
            )
            db.add(store)
            db.commit()
            db.refresh(store)
            
            # Add default recurring expenses
            rent = RecurringExpense(
                store_id=store.id,
                name="Shop Rent",
                amount=50000.00,
                category="rent"
            )
            db.add(rent)
            db.commit()

        owner = db.query(User).filter(User.username == settings.FIRST_OWNER_USERNAME).first()
        if not owner:
            owner = User(
                username=settings.FIRST_OWNER_USERNAME,
                password_hash=get_password_hash(settings.FIRST_OWNER_PASSWORD),
                full_name=settings.FIRST_OWNER_FULL_NAME,
                role="owner",
                store_id=store.id,
                is_active=True
            )
            db.add(owner)
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables and seed exist when DB is reachable
    try:
        Base.metadata.create_all(bind=engine)
        init_first_store_and_owner()
    except Exception as e:
        # Don't crash app startup if local PostgreSQL is starting or during mocked tests
        pass
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(health.router)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(stores.router, prefix=settings.API_V1_STR)
app.include_router(products.categories_router, prefix=settings.API_V1_STR)
app.include_router(products.products_router, prefix=settings.API_V1_STR)
app.include_router(inventory.inventory_router, prefix=settings.API_V1_STR)
app.include_router(inventory.stock_takes_router, prefix=settings.API_V1_STR)
app.include_router(sales.router, prefix=settings.API_V1_STR)
app.include_router(pre_sales.router, prefix=settings.API_V1_STR)
app.include_router(customers.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": "POS Business Management API",
        "status": "running",
        "docs": "/docs"
    }
