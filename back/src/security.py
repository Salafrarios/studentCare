import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import jwt


JWT_ALGORITHM = "HS256"
JWT_SECRET = os.getenv("STUDENTCARE_JWT_SECRET", "studentcare-dev-secret-change-me")
TOKEN_EXPIRE_MINUTES = int(os.getenv("STUDENTCARE_TOKEN_EXPIRE_MINUTES", "480"))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    iterations = 210_000
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations
    ).hex()
    return f"pbkdf2_sha256${iterations}${salt}${digest}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt, expected_digest = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual_digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations)
        ).hex()
        return hmac.compare_digest(actual_digest, expected_digest)
    except (TypeError, ValueError):
        return False


def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
