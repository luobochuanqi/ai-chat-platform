"""P4: 提示词市场 API。

端点：
- GET  /prompts                社区浏览（tag 筛选 / sort 排序 / q 搜索，排序预置→自己→他人）
- POST /prompts                创建并发布到社区
- POST /prompts/{id}/like      点赞/取消（toggle，PromptLike 去重）
- POST /prompts/{id}/use       用此提示词开新会话（use_count+1，返回 session_id）
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import SystemPrompt, PromptLike, User, ChatSession
from app.models.schemas import PromptCreate

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.get("")
def browse_prompts(
    tag: Optional[str] = None,
    sort: str = "newest",
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """社区浏览：内置 + 已发布（is_public）的提示词。"""
    query = (
        db.query(SystemPrompt)
        .filter(SystemPrompt.is_active == True)  # noqa: E712
        .filter((SystemPrompt.is_builtin == True) | (SystemPrompt.is_public == True))  # noqa: E712
    )
    if tag:
        # sqlite JSON 存 TEXT，模糊匹配标签（够用，无需 json_each）
        query = query.filter(SystemPrompt.tags.like(f'%"{tag}"%'))
    if q:
        query = query.filter(
            SystemPrompt.name.like(f"%{q}%") | SystemPrompt.description.like(f"%{q}%")
        )
    if sort == "popular":
        query = query.order_by(SystemPrompt.likes.desc())
    elif sort == "most_used":
        query = query.order_by(SystemPrompt.use_count.desc())
    else:
        query = query.order_by(SystemPrompt.created_at.desc())
    prompts = query.all()

    # 二次排序：预置 → 自己 → 他人（稳定优先级）
    def group_key(p: SystemPrompt) -> int:
        if p.is_builtin:
            return 0
        if p.user_id == current_user.id:
            return 1
        return 2
    prompts.sort(key=group_key)

    result = []
    for p in prompts:
        author = db.query(User).filter(User.id == p.user_id).first() if p.user_id else None
        is_liked = (
            db.query(PromptLike)
            .filter(PromptLike.prompt_id == p.id, PromptLike.user_id == current_user.id)
            .first()
            is not None
        )
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "prompt": p.prompt,
            "tags": p.tags or [],
            "is_builtin": p.is_builtin,
            "is_public": p.is_public,
            "likes": p.likes or 0,
            "use_count": p.use_count or 0,
            "created_at": p.created_at,
            "user_id": p.user_id,
            "author_nickname": author.nickname if author else ("官方" if p.is_builtin else "匿名"),
            "is_liked": is_liked,
            "is_owner": p.user_id == current_user.id,
        })
    return result


@router.post("")
def create_prompt(
    data: PromptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建提示词（市场入口创建即发布到社区）"""
    prompt = SystemPrompt(
        name=data.name,
        description=data.description,
        prompt=data.prompt,
        tags=data.tags,
        is_builtin=False,
        is_public=True,
        user_id=current_user.id,
        is_active=True,
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return {"id": prompt.id}


@router.post("/{prompt_id}/like")
def like_prompt(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """点赞/取消（toggle，PromptLike 去重）"""
    prompt = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    existing = (
        db.query(PromptLike)
        .filter(PromptLike.prompt_id == prompt_id, PromptLike.user_id == current_user.id)
        .first()
    )
    if existing:
        db.delete(existing)
        prompt.likes = max(0, (prompt.likes or 0) - 1)
        liked = False
    else:
        db.add(PromptLike(prompt_id=prompt_id, user_id=current_user.id))
        prompt.likes = (prompt.likes or 0) + 1
        liked = True
    db.commit()
    return {"liked": liked, "likes": prompt.likes}


@router.post("/{prompt_id}/use")
def use_prompt(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """用此提示词开新会话：use_count+1，创建 session（system_prompt=该提示词）"""
    prompt = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    prompt.use_count = (prompt.use_count or 0) + 1
    session = ChatSession(
        user_id=current_user.id,
        title="新会话",
        system_prompt=prompt.prompt,
        enabled_skills=[],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id}
