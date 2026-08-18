import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from backend.app.core.database import Base, get_db
from backend.app.main import app
from backend.app.models.user import User
from backend.app.models.store import Store, RecurringExpense
from backend.app.core.security import get_password_hash

# In-memory SQLite for superfast regression tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    
    # Seed default store
    store = Store(
        name="Test Solar Store",
        address="Nairobi, Kenya",
        phone="+254711223344",
        tax_id="P123456789X",
        vat_rate=0.1600,
        is_active=True
    )
    session.add(store)
    session.commit()
    session.refresh(store)
    
    # Seed owner
    owner = User(
        username="owner",
        password_hash=get_password_hash("owner123"),
        full_name="Store Owner",
        role="owner",
        store_id=store.id,
        is_active=True
    )
    session.add(owner)
    
    # Seed staff
    staff = User(
        username="staff",
        password_hash=get_password_hash("staff123"),
        full_name="Staff Cashier",
        role="staff",
        store_id=store.id,
        is_active=True
    )
    session.add(staff)
    
    # Seed recurring expense
    rent = RecurringExpense(
        store_id=store.id,
        name="Store Rent",
        amount=45000.00,
        category="rent"
    )
    session.add(rent)
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def owner_auth_client(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": "owner123"}
    )
    assert login_res.status_code == 200
    return client


@pytest.fixture(scope="function")
def staff_auth_client(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": "staff", "password": "staff123"}
    )
    assert login_res.status_code == 200
    return client
