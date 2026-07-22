"""P4 迁移：SystemPrompt 加 4 列（ALTER）+ PromptLike 表（create_all）。

运行：cd backend && .venv/bin/python migrate_p4.py
幂等：重复运行不会重复加列（检查列是否存在）。
"""
from sqlalchemy import text, inspect

from app.core.database import engine, Base
import app.models.models  # noqa: F401 — 确保所有模型注册到 Base.metadata


def main() -> None:
    insp = inspect(engine)
    cols = [c["name"] for c in insp.get_columns("system_prompts")]

    with engine.connect() as conn:
        # sqlite 不支持 JSON 类型名，用 TEXT；SQLAlchemy Column(JSON) 照常读写
        if "tags" not in cols:
            conn.execute(text("ALTER TABLE system_prompts ADD COLUMN tags TEXT"))
            print("  + system_prompts.tags")
        if "is_public" not in cols:
            conn.execute(text("ALTER TABLE system_prompts ADD COLUMN is_public BOOLEAN DEFAULT 0"))
            print("  + system_prompts.is_public")
        if "likes" not in cols:
            conn.execute(text("ALTER TABLE system_prompts ADD COLUMN likes INTEGER DEFAULT 0"))
            print("  + system_prompts.likes")
        if "use_count" not in cols:
            conn.execute(text("ALTER TABLE system_prompts ADD COLUMN use_count INTEGER DEFAULT 0"))
            print("  + system_prompts.use_count")
        conn.commit()

    # create_all：建 prompt_likes 新表（已存在的表不受影响）
    Base.metadata.create_all(bind=engine)
    print("P4 迁移完成（prompt_likes 表已建，system_prompts 列已补齐）")


if __name__ == "__main__":
    main()
