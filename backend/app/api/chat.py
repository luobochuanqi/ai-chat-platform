from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin
from app.models.schemas import *
from app.models.models import ChatSession, ChatMessage, User, SystemPrompt
from app.services.ai_service import chat_with_deepseek

try:
    from duckduckgo_search import DDGS
    DDGS_AVAILABLE = True
except ImportError:
    DDGS_AVAILABLE = False

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/sessions", response_model=ChatSessionResponse)
def create_session(data: ChatSessionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = ChatSession(
        user_id=current_user.id,
        title=data.title,
        system_prompt=data.system_prompt
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/sessions", response_model=List[ChatSessionResponse])
def list_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.updated_at.desc()).all()
    result = []
    for s in sessions:
        msg_count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
        result.append({
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
            "message_count": msg_count
        })
    return result

@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at).all()
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "messages": messages
    }

@router.put("/sessions/{session_id}")
def update_session_title(session_id: int, title: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = title
    db.commit()
    db.refresh(session)
    return session

@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}

@router.post("/sessions/generate-title")
async def generate_session_title(request: GenerateTitleRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generate a title for a session based on the first message"""
    session = db.query(ChatSession).filter(ChatSession.id == request.session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Only generate title if it's still the default
    if session.title != "新会话":
        return {"title": session.title}
    
    try:
        messages = [
            {"role": "system", "content": "你是一个标题生成助手。请根据用户的对话内容，生成一个简短的标题（不超过10个字），概括对话主题。只返回标题，不要其他内容。"},
            {"role": "user", "content": f"请为以下对话生成标题：{request.first_message[:100]}"}
        ]
        response = await chat_with_deepseek(messages)
        title = response["choices"][0]["message"]["content"].strip()
        # Clean up title
        title = title.replace('"', '').replace("'", "").strip()
        if len(title) > 20:
            title = title[:20]
        if not title:
            title = "新会话"
        
        session.title = title
        db.commit()
        return {"title": title}
    except Exception as e:
        print(f"Title generation error: {e}")
        return {"title": "新会话"}

@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def send_message(session_id: int, message: ChatMessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check quota
    if current_user.chat_used >= current_user.chat_quota:
        raise HTTPException(status_code=403, detail="Chat quota exceeded")
    
    # Save user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=message.content)
    db.add(user_msg)
    db.commit()
    
    # Get conversation history (last 10 messages)
    history = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.desc()).limit(10).all()
    history.reverse()
    
    messages = []
    # Prepend session system_prompt if set
    if session.system_prompt:
        messages.append({"role": "system", "content": session.system_prompt})
    messages.extend([{"role": m.role, "content": m.content} for m in history])
    
    # Web search if enabled
    if message.web_search and DDGS_AVAILABLE:
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(message.content, max_results=3))
                if results:
                    search_text = "\n\n".join([
                        f"[{i+1}] {r.get('title', '')}: {r.get('body', '')}" 
                        for i, r in enumerate(results)
                    ])
                    messages[-1]["content"] = f"{message.content}\n\n以下是我搜索到的相关信息：\n{search_text}\n\n请根据以上信息回答我的问题。"
        except Exception as e:
            print(f"Web search error: {e}")
    elif message.web_search and not DDGS_AVAILABLE:
        print("Web search requested but duckduckgo_search not available")
    
    # Call DeepSeek API
    try:
        response = await chat_with_deepseek(messages)
        assistant_content = response["choices"][0]["message"]["content"]
        tokens_used = response.get("usage", {}).get("total_tokens", 0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
    
    # Save assistant message with token count
    assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=assistant_content, tokens_used=tokens_used)
    db.add(assistant_msg)
    
    # Update quota
    current_user.chat_used += 1
    db.commit()
    db.refresh(assistant_msg)
    
    return assistant_msg

# System Prompt endpoints
@router.get("/system-prompts", response_model=List[SystemPromptResponse])
def list_system_prompts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all system prompts (built-in + user's custom)"""
    prompts = db.query(SystemPrompt).filter(
        (SystemPrompt.is_builtin == True) | (SystemPrompt.user_id == current_user.id)
    ).filter(SystemPrompt.is_active == True).all()
    return prompts

@router.post("/system-prompts", response_model=SystemPromptResponse)
def create_system_prompt(prompt: SystemPromptCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new system prompt"""
    new_prompt = SystemPrompt(
        name=prompt.name,
        description=prompt.description,
        prompt=prompt.prompt,
        is_builtin=False,
        user_id=current_user.id,
        is_active=True
    )
    db.add(new_prompt)
    db.commit()
    db.refresh(new_prompt)
    return new_prompt

@router.put("/system-prompts/{prompt_id}", response_model=SystemPromptResponse)
def update_system_prompt(prompt_id: int, prompt: SystemPromptUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update a system prompt"""
    existing = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="System prompt not found")
    if existing.is_builtin:
        raise HTTPException(status_code=403, detail="Cannot modify built-in prompts")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot modify other users' prompts")
    
    if prompt.name is not None:
        existing.name = prompt.name
    if prompt.description is not None:
        existing.description = prompt.description
    if prompt.prompt is not None:
        existing.prompt = prompt.prompt
    
    db.commit()
    db.refresh(existing)
    return existing

@router.delete("/system-prompts/{prompt_id}")
def delete_system_prompt(prompt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a system prompt"""
    existing = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="System prompt not found")
    if existing.is_builtin:
        raise HTTPException(status_code=403, detail="Cannot delete built-in prompts")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete other users' prompts")
    
    db.delete(existing)
    db.commit()
    return {"message": "System prompt deleted"}

# Admin endpoints for system prompts
@router.post("/system-prompts/builtin", response_model=SystemPromptResponse)
def create_builtin_prompt(prompt: SystemPromptCreate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    """Create a built-in system prompt (admin only)"""
    new_prompt = SystemPrompt(
        name=prompt.name,
        description=prompt.description,
        prompt=prompt.prompt,
        is_builtin=True,
        is_active=True
    )
    db.add(new_prompt)
    db.commit()
    db.refresh(new_prompt)
    return new_prompt

@router.get("/system-prompts/admin/all", response_model=List[SystemPromptResponse])
def list_all_prompts(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    """List all system prompts (admin only)"""
    prompts = db.query(SystemPrompt).order_by(SystemPrompt.created_at.desc()).all()
    return prompts

@router.put("/system-prompts/admin/{prompt_id}", response_model=SystemPromptResponse)
def admin_update_prompt(prompt_id: int, prompt: SystemPromptUpdate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    """Update any system prompt (admin only)"""
    existing = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="System prompt not found")
    if prompt.name is not None:
        existing.name = prompt.name
    if prompt.description is not None:
        existing.description = prompt.description
    if prompt.prompt is not None:
        existing.prompt = prompt.prompt
    db.commit()
    db.refresh(existing)
    return existing

@router.delete("/system-prompts/admin/{prompt_id}")
def admin_delete_prompt(prompt_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    """Delete any system prompt (admin only)"""
    existing = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="System prompt not found")
    db.delete(existing)
    db.commit()
    return {"message": "System prompt deleted"}
