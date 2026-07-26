"""Bug #6 回归测试：GET /chat/sessions/{id} 必须返回 system_prompt。

运行：cd backend && python -m pytest tests/test_session_system_prompt.py -v
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.deps import get_current_user
from app.models.models import User, ChatSession

# 确保所有模型注册到 Base.metadata
import app.models.models  # noqa: F401

from app.main import app


@pytest.fixture()
def client():
    # 单连接内存 SQLite，跨线程共享
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False)

    # 创建测试用户
    db = TestSession()
    user = User(username="tester", nickname="测试", hashed_password="x", is_admin=False)
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user():
        db = TestSession()
        try:
            u = db.query(User).filter(User.username == "tester").first()
            return u
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_get_session_returns_system_prompt(client):
    """Bug #6: 创建带 system_prompt 的会话后，GET 详情必须返回该字段。"""
    # 创建会话（模拟提示词市场 use_prompt 的行为）
    resp = client.post("/chat/sessions", json={"title": "图片助手", "system_prompt": "你是一个图片生成学习助手。"})
    assert resp.status_code == 200
    session_id = resp.json()["id"]

    # 获取会话详情
    resp = client.get(f"/chat/sessions/{session_id}")
    assert resp.status_code == 200
    data = resp.json()

    # 核心断言：system_prompt 必须存在且正确
    assert "system_prompt" in data, f"响应缺少 system_prompt 字段，实际 keys: {list(data.keys())}"
    assert data["system_prompt"] == "你是一个图片生成学习助手。"


def test_get_session_system_prompt_null_when_not_set(client):
    """未设置 system_prompt 的会话，字段应为 null 而非缺失。"""
    resp = client.post("/chat/sessions", json={"title": "普通对话"})
    assert resp.status_code == 200
    session_id = resp.json()["id"]

    resp = client.get(f"/chat/sessions/{session_id}")
    assert resp.status_code == 200
    data = resp.json()

    assert "system_prompt" in data, f"响应缺少 system_prompt 字段，实际 keys: {list(data.keys())}"
    assert data["system_prompt"] is None
