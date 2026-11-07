from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.postgres import get_db
from app.models.postgres_models import User
from app.models.pydantic_models import UserLogin, UserCreate, Token, UserResponse
from app.core.security import verify_password, get_password_hash, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(creds: UserLogin, db: Session = Depends(get_db)):
    # Demo/standard investigator fallback
    if creds.username == "investigator" and creds.password == "forensics2026":
        token = create_access_token(subject="investigator")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": 1,
                "username": "investigator",
                "email": "investigator@cybercell.gov.in",
                "badge_number": "CC-9042",
                "role": "LEAD_INVESTIGATOR"
            }
        }

    user = db.query(User).filter(User.username == creds.username).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        # Allow default fallback demo login for easy testing
        if creds.username == "admin" and creds.password == "admin123":
            token = create_access_token(subject="admin")
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": 1,
                    "username": "admin",
                    "email": "admin@cyberforensics.local",
                    "badge_number": "ADM-001",
                    "role": "ADMIN"
                }
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    token = create_access_token(subject=user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
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
        role=user_in.role or "INVESTIGATOR"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
