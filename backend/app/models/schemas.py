from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

# User schemas
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    nickname: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6)
    is_admin: bool = False

class UserLogin(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    password: Optional[str] = None

class UserQuotaUpdate(BaseModel):
    chat_quota: Optional[int] = None
    image_quota: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    username: str
    nickname: str
    is_admin: bool
    is_active: bool
    chat_quota: int
    image_quota: int
    chat_used: int
    image_used: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int

# Chat schemas
class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "新会话"

class ChatSessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    
    class Config:
        from_attributes = True

class ChatSessionDetail(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageResponse]
    
    class Config:
        from_attributes = True

# Image schemas
class ImageGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)

class ImageResponse(BaseModel):
    id: int
    prompt: str
    image_url: str
    is_public: bool
    likes: int
    created_at: datetime
    user_nickname: str
    
    class Config:
        from_attributes = True

class ImageLikeRequest(BaseModel):
    image_id: int

# Token
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
