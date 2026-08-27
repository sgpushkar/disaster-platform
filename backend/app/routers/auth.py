"""
/signup and /login endpoints.
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.models import User, RoleEnum
from app.schemas.schemas import UserSignup, UserLogin, Token, UserOut

router = APIRouter(tags=["auth"])


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignup, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # First registered user becomes admin automatically, everyone after is a normal user
    is_first_user = db.query(User).count() == 0
    user = User(
        name=payload.name,
        email=payload.email,
        password=hash_password(payload.password),
        role=RoleEnum.admin if is_first_user else RoleEnum.user,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token(
        data={"sub": str(user.id), "role": role_val},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token(
        data={"sub": str(user.id), "role": role_val},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=token, user=UserOut.model_validate(user))
