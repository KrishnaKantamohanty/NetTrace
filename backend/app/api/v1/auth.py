import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.postgres import get_db
from app.models.postgres_models import User
from app.models.pydantic_models import UserLogin, UserCreate, Token, UserResponse
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    require_roles
)

logger = logging.getLogger("nettrace.auth")

router = APIRouter(prefix="/auth", tags=["Authentication & Access Control"])

@router.post("/login", response_model=Token)
def login(creds: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates investigator via username and password against database.
    Strictly verifies Argon2id / bcrypt cryptographic password hashes without hardcoded bypasses.
    """
    user = db.query(User).filter(User.username == creds.username).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        logger.warning(f"Failed authentication attempt for username: {creds.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Transparent SHA-256 → Argon2id hash migration on successful login
    if not user.hashed_password.startswith("$argon2"):
        try:
            user.hashed_password = get_password_hash(creds.password)
            db.commit()
            logger.info(f"Password hash migrated to Argon2id for user: {user.username}")
        except Exception as mig_err:
            logger.warning(f"Failed to migrate password hash for {user.username}: {mig_err}")
            db.rollback()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact an administrator."
        )

    token = create_access_token(subject=user.username, role=user.role)
    logger.info(f"Successful login for investigator: {user.username} (Role: {user.role})")
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "badge_number": user.badge_number,
            "role": user.role
        }
    }

@router.post("/token", response_model=Token, include_in_schema=False)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """OAuth2 password form login endpoint for Swagger UI interactive authentication."""
    return login(UserLogin(username=form_data.username, password=form_data.password), db=db)

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns profile and authorized roles of the currently authenticated officer."""
    return current_user

@router.post("/register", response_model=UserResponse)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "LEAD_INVESTIGATOR"]))
):
    """Registers a new officer account. Restricted to ADMIN and LEAD_INVESTIGATOR roles."""
    existing = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        badge_number=user_in.badge_number,
        role=user_in.role or "INVESTIGATOR",
        is_active=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"New user registered: {user.username} (Created by: {current_user.username})")
    return user

@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "LEAD_INVESTIGATOR"]))
):
    """Lists all registered system users. Restricted to ADMIN and LEAD_INVESTIGATOR roles."""
    return db.query(User).all()

@router.patch("/users/{user_id}/status", response_model=UserResponse)
def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    """Deactivates or activates an officer account. Restricted to ADMIN."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Officer account not found")
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own administrative account")
    
    target_user.is_active = 0 if target_user.is_active == 1 else 1
    db.commit()
    db.refresh(target_user)
    logger.info(f"Officer {target_user.username} status toggled to {target_user.is_active} by {current_user.username}")
    return target_user
