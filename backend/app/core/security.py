import hashlib, secrets, uuid
from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from .config import settings

ph = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)  # Argon2id, OWASP params

def hash_password(pw: str) -> str:
    return ph.hash(pw)

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return ph.verify(hashed, pw)
    except VerifyMismatchError:
        return False
    except Exception:
        return False

def create_access_token(user_id: int, public_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    return jwt.encode({"sub": str(user_id), "pid": public_id, "exp": exp, "type": "access"},
                      settings.secret_key, algorithm=settings.algorithm)

def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])

def new_refresh_token():
    raw = secrets.token_urlsafe(48)
    return raw, hashlib.sha256(raw.encode()).hexdigest(), str(uuid.uuid4())
