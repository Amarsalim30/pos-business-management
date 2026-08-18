import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session as DBSession
from app.models.user import User
from app.models.audit import Session as UserSession, AuditLog
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.config import settings


def authenticate_user(db: DBSession, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_user_session(db: DBSession, user: User) -> Tuple[str, str]:
    jti = str(uuid.uuid4())
    access_token = create_access_token({"sub": str(user.id), "role": user.role, "jti": jti})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role, "jti": jti})
    
    # Store session in DB
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    session = UserSession(
        user_id=user.id,
        token_jti=jti,
        expires_at=expires_at
    )
    db.add(session)
    
    # Add audit log
    audit = AuditLog(
        user_id=user.id,
        action="login",
        table_name="users",
        record_id=user.id,
        changes={"username": user.username}
    )
    db.add(audit)
    db.commit()
    
    return access_token, refresh_token


def invalidate_user_session(db: DBSession, jti: str, user_id: Optional[int] = None) -> bool:
    session = db.query(UserSession).filter(UserSession.token_jti == jti).first()
    if session:
        db.delete(session)
        if user_id:
            audit = AuditLog(
                user_id=user_id,
                action="logout",
                table_name="sessions",
                record_id=session.id
            )
            db.add(audit)
        db.commit()
        return True
    return False


def refresh_user_token(db: DBSession, refresh_token: str) -> Optional[Tuple[str, User]]:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return None
    
    jti = payload.get("jti")
    user_id = payload.get("sub")
    if not jti or not user_id:
        return None
    
    session = db.query(UserSession).filter(
        UserSession.token_jti == jti,
        UserSession.user_id == int(user_id)
    ).first()
    
    now_utc = datetime.now(timezone.utc)
    sess_exp = session.expires_at
    if sess_exp.tzinfo is None:
        sess_exp = sess_exp.replace(tzinfo=timezone.utc)

    if sess_exp < now_utc:
        return None
    
    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    if not user:
        return None
    
    # Issue new access token with same JTI
    new_access_token = create_access_token({"sub": str(user.id), "role": user.role, "jti": jti})
    return new_access_token, user
