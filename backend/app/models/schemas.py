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
    web_search: Optional[bool] = False

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    tokens_used: Optional[int] = None
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

# System Prompt schemas
class SystemPromptCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    prompt: str = Field(..., min_length=1)

class SystemPromptUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    prompt: Optional[str] = Field(None, min_length=1)

class SystemPromptResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    prompt: str
    is_builtin: bool
    user_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    
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
    is_liked: Optional[bool] = False
    
    class Config:
        from_attributes = True

class ImageLikeRequest(BaseModel):
    image_id: int

class BatchImageRequest(BaseModel):
    image_ids: List[int]

# Token
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
