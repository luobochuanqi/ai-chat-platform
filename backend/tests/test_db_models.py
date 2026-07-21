"""DB 模型字段测试：验证 enabled_skills / tool_calls 的存储。

用内存 SQLite + 项目自身的 Base.metadata，隔离、快速，不碰真实数据库文件。
运行：cd backend && python -m unittest tests.test_db_models -v
"""
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.models import User, ChatSession, ChatMessage
from app.skills import SKILL_REGISTRY

# 确保所有模型类已注册到 Base.metadata（导入即注册）
import app.models.models  # noqa: F401


class TestDbModels(unittest.TestCase):
    def setUp(self):
        # 内存 SQLite：每个测试独立、不落盘
        self.engine = create_engine("sqlite://", future=True)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)

    def _make_user(self, db) -> User:
        user = User(
            username="stu1",
            nickname="学生1",
            hashed_password="x",
            is_admin=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def test_enabled_skills_default_empty(self):
        """新建 session 未指定 enabled_skills，应为空列表（走原路径）。"""
        with self.Session() as db:
            user = self._make_user(db)
            session = ChatSession(user_id=user.id)
            db.add(session)
            db.commit()
            db.refresh(session)
        self.assertEqual(session.enabled_skills, [])

    def test_enabled_skills_persist(self):
        """自定义 enabled_skills 能正确存取。"""
        with self.Session() as db:
            user = self._make_user(db)
            session = ChatSession(
                user_id=user.id,
                enabled_skills=["calculator", "random_generator"],
            )
            db.add(session)
            db.commit()
            db.refresh(session)
        self.assertEqual(session.enabled_skills, ["calculator", "random_generator"])

    def test_tool_calls_nullable_and_persist(self):
        """ChatMessage.tool_calls 默认 null，能存 list。"""
        with self.Session() as db:
            user = self._make_user(db)
            session = ChatSession(user_id=user.id)
            db.add(session)
            db.commit()

            # 无 tool_calls → null
            msg1 = ChatMessage(session_id=session.id, role="user", content="hi")
            db.add(msg1)
            db.commit()
            db.refresh(msg1)
            self.assertIsNone(msg1.tool_calls)

            # 带 tool_calls → 存 list
            log = [
                {
                    "name": "calculator",
                    "args": {"expression": "1+1"},
                    "result": "1+1 = 2",
                    "ok": True,
                }
            ]
            msg2 = ChatMessage(
                session_id=session.id,
                role="assistant",
                content="= 2",
                tool_calls=log,
            )
            db.add(msg2)
            db.commit()
            db.refresh(msg2)
            self.assertEqual(msg2.tool_calls, log)


class TestRegistryDefaultSkills(unittest.TestCase):
    """create_session 的默认值（None→全部启用）依赖注册表内容，此处守住。"""

    def test_registry_has_three_skills(self):
        names = SKILL_REGISTRY.list_names()
        self.assertEqual(len(names), 3)
        for expected in ["calculator", "get_current_time", "random_generator"]:
            self.assertIn(expected, names)


if __name__ == "__main__":
    unittest.main()
