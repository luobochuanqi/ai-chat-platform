from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.models import User, ChatSession, GeneratedImage, ChatMessage
from typing import Optional

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    total_users = db.query(User).count()
    total_sessions = db.query(ChatSession).count()
    total_images = db.query(GeneratedImage).count()
    public_images = db.query(GeneratedImage).filter(GeneratedImage.is_public == True).count()
    total_messages = db.query(ChatMessage).count()
    
    return {
        "total_users": total_users,
        "total_sessions": total_sessions,
        "total_images": total_images,
        "public_images": public_images,
        "total_messages": total_messages,
    }

@router.get("/users/{user_id}/sessions")
def get_user_sessions(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.updated_at.desc()).all()
    return sessions

@router.get("/users/{user_id}/images")
def get_user_images(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    images = db.query(GeneratedImage).filter(GeneratedImage.user_id == user_id).order_by(GeneratedImage.created_at.desc()).all()
    return images
