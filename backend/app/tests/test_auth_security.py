import pytest
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
)

def test_argon2id_hashing_and_verification():
    raw_password = "SecureInvestigatorPassword#2026"
    hashed = get_password_hash(raw_password)

    # Must be hashed using argon2
    assert hashed.startswith("$argon2") or "argon2" in hashed
    assert hashed != raw_password

    # Correct password verifies
    assert verify_password(raw_password, hashed) is True

    # Incorrect password fails
    assert verify_password("WrongPassword123", hashed) is False

def test_jwt_token_lifecycle():
    token = create_access_token(subject="investigator_01", role="INVESTIGATOR")

    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == "investigator_01"
    assert payload.get("role") == "INVESTIGATOR"

def test_invalid_jwt_token():
    invalid_token = "invalid.bearer.jwt_payload"
    payload = decode_access_token(invalid_token)
    assert payload is None
