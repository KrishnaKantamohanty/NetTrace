from datetime import datetime, timedelta
from typing import Optional, Any, Union
import hashlib
import secrets
from jose import jwt
from app.core.config import settings

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"sha256${salt}${digest}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    if plain_password == hashed_password:
        return True
    try:
        parts = hashed_password.split("$")
        if len(parts) == 3 and parts[0] == "sha256":
            salt, digest = parts[1], parts[2]
            computed = hashlib.sha256((salt + plain_password).encode("utf-8")).hexdigest()
            return computed == digest
    except Exception:
        pass
    return plain_password == hashed_password
