from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..db import get_db
from ..models import User, RefreshToken
from ..schemas import RegisterIn, LoginIn, RefreshIn, TokenOut, UserOut
from ..core.security import hash_password, verify_password, create_access_token, new_refresh_token
from ..core.config import settings
from ..deps import get_current_user
import hashlib

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

def user_out(u: User) -> UserOut:
    return UserOut(public_id=u.public_id, name=u.name, email=u.email, college=u.college,
                   course=u.course, language=getattr(u, 'language', 'hinglish'), xp=u.xp, level=u.level, streak_days=u.streak_days)

def issue_tokens(db: Session, user: User, family_id: str = None) -> TokenOut:
    raw, hashed, fam = new_refresh_token()
    fam = family_id or fam
    db.add(RefreshToken(user_id=user.id, token_hash=hashed, family_id=fam,
                        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days)))
    db.commit()
    return TokenOut(access_token=create_access_token(user.id, user.public_id), refresh_token=raw, user=user_out(user))

@router.post("/register", response_model=TokenOut, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, data: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(409, "Is email se account pehle se hai")
    user = User(name=data.name.strip(), email=data.email.lower(), password_hash=hash_password(data.password),
                college=data.college.strip(), course=data.course.strip(),
                language=(data.language if data.language in ("hindi", "urdu", "hinglish", "english") else "hinglish"))
    db.add(user); db.commit(); db.refresh(user)
    return issue_tokens(db, user)

@router.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
def login(request: Request, data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ya password galat hai")
    return issue_tokens(db, user)

@router.post("/refresh", response_model=TokenOut)
def refresh(data: RefreshIn, db: Session = Depends(get_db)):
    hashed = hashlib.sha256(data.refresh_token.encode()).hexdigest()
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == hashed).first()
    exp = row.expires_at if row else None
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)  # SQLite/MySQL naive datetime ko UTC maan lo
    if not row or row.revoked or exp < datetime.now(timezone.utc):
        if row:  # reuse of a revoked token -> kill the whole family
            db.query(RefreshToken).filter(RefreshToken.family_id == row.family_id).update({"revoked": True}); db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, dobara login karo")
    row.revoked = True; db.commit()
    user = db.get(User, row.user_id)
    return issue_tokens(db, user, family_id=row.family_id)

@router.post("/logout")
def logout(data: RefreshIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hashed = hashlib.sha256(data.refresh_token.encode()).hexdigest()
    db.query(RefreshToken).filter(RefreshToken.token_hash == hashed, RefreshToken.user_id == user.id).update({"revoked": True})
    db.commit()
    return {"ok": True}

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)
