from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin
from app.core.security import verify_password, create_access_token
from app.models.schemas import *
from app.models.models import User
from app.services.user_service import *

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/login", response_model=Token)
def login(user_login: UserLogin, db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_login.username)
    if not user or not verify_password(user_login.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is disabled")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/create", response_model=UserResponse)
def create_single_user(user: UserCreate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    if get_user_by_username(db, user.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    return create_user(db, user)

@router.post("/create-bulk")
def create_bulk_users(users: List[UserCreate], db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    created = []
    for user in users:
        if not get_user_by_username(db, user.username):
            created.append(create_user(db, user))
    return {"created": len(created), "users": created}

@router.get("/list", response_model=UserListResponse)
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    users = db.query(User).offset(skip).limit(limit).all()
    total = db.query(User).count()
    return {"users": users, "total": total}

@router.put("/{user_id}/quota")
def update_user_quota(user_id: int, quota: UserQuotaUpdate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return update_user(db, user, {"chat_quota": quota.chat_quota, "image_quota": quota.image_quota})

@router.put("/{user_id}/toggle")
def toggle_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_single_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}
