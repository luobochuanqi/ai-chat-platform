from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.models import User
from app.models.schemas import UserCreate
from app.core.security import get_password_hash
from app.core.config import get_settings

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, user: UserCreate):
    settings = get_settings()
    db_user = User(
        username=user.username,
        nickname=user.nickname,
        hashed_password=get_password_hash(user.password),
        is_admin=user.is_admin,
        chat_quota=settings.DEFAULT_CHAT_QUOTA,
        image_quota=settings.DEFAULT_IMAGE_QUOTA,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_users_bulk(db: Session, users: list):
    created = []
    for user_data in users:
        user = UserCreate(**user_data)
        if get_user_by_username(db, user.username):
            continue
        created.append(create_user(db, user))
    return created

def update_user(db: Session, user: User, data: dict):
    if "password" in data and data["password"]:
        user.hashed_password = get_password_hash(data["password"])
    if "nickname" in data and data["nickname"]:
        user.nickname = data["nickname"]
    if "is_active" in data:
        user.is_active = data["is_active"]
    if "chat_quota" in data and data["chat_quota"] is not None:
        user.chat_quota = data["chat_quota"]
    if "image_quota" in data and data["image_quota"] is not None:
        user.image_quota = data["image_quota"]
    if "chat_used" in data and data["chat_used"] is not None:
        user.chat_used = data["chat_used"]
    if "image_used" in data and data["image_used"] is not None:
        user.image_used = data["image_used"]
    db.commit()
    db.refresh(user)
    return user

def delete_user(db: Session, user: User):
    db.delete(user)
    db.commit()
