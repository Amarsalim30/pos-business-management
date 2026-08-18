from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.audit import Session as UserSession


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    # 1. Check HttpOnly cookie first
    token = request.cookies.get("access_token")
    
    # 2. Check Authorization header (Bearer token) fallback
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    user_id = payload.get("sub")
    jti = payload.get("jti")
    if not user_id or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    # Verify session is still valid in DB
    session = db.query(UserSession).filter(
        UserSession.token_jti == jti,
        UserSession.user_id == int(user_id)
    ).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been invalidated",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive or deleted",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    return user


def require_role(allowed_role: str):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != allowed_role and current_user.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required role: {allowed_role}"
            )
        return current_user
    return role_checker


# Specific dependency shortcuts
require_owner = require_role("owner")
require_staff = require_role("staff")
