from datetime import datetime, timezone
from typing import List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.permissions import ROLE_PRESET_PERMISSIONS


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(30), default="staff", nullable=False)  # "owner" | "accountant" | "staff" | "storekeeper" | "project_manager"
    permissions = Column(JSON, nullable=True, default=None)  # Custom override list of permission tokens
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    store = relationship("Store", back_populates="users")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

    @property
    def effective_permissions(self) -> List[str]:
        if self.role in ("owner", "admin"):
            return ["*"]
        if self.permissions is not None:
            return self.permissions
        return ROLE_PRESET_PERMISSIONS.get(self.role, ROLE_PRESET_PERMISSIONS["staff"])
