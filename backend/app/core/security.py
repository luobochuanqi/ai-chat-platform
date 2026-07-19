from jose import jwt, JWTError
from datetime import datetime, timedelta
from app.core.config import get_settings
import hashlib
import secrets

settings = get_settings()

def _hash_password(password: str) -> str:
    """使用 SHA-256 + salt 哈希密码，避免 bcrypt 的 72 字节限制"""
    salt = secrets.token_hex(16)
    hash_value = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"sha256${salt}${hash_value}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    if not hashed_password or '$' not in hashed_password:
        return False
    parts = hashed_password.split('$')
    if len(parts) != 3 or parts[0] != 'sha256':
        return False
    salt = parts[1]
    stored_hash = parts[2]
    computed_hash = hashlib.sha256((plain_password + salt).encode()).hexdigest()
    return secrets.compare_digest(stored_hash, computed_hash)

def get_password_hash(password: str) -> str:
    return _hash_password(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        return {}
