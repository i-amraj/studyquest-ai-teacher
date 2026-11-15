from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt as pyjwt
from sqlalchemy.orm import Session
from .db import get_db
from .models import User
from .core.security import decode_access_token

bearer = HTTPBearer(auto_error=False)

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login required")
    try:
        payload = decode_access_token(creds.credentials)
        if payload.get("type") != "access":
            raise ValueError("wrong token type")
        user = db.get(User, int(payload["sub"]))
    except (pyjwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    # Streak: roz ki pehli activity par update
    from datetime import date, timedelta
    today = date.today().isoformat()
    if user.last_active_date != today:
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        user.streak_days = (user.streak_days or 0) + 1 if user.last_active_date == yesterday else 1
        user.last_active_date = today
        db.commit()
    return user
