from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

# SQLite 并发优化：WAL 模式让读写不互斥，busy_timeout 让并发写排队而非 database is locked。
# 仅对 SQLite 生效，换 PostgreSQL 时本块不触发。
if "sqlite" in settings.DATABASE_URL:
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")       # 读写并发（默认 DELETE 会全库锁）
        cursor.execute("PRAGMA busy_timeout=5000")      # 写锁冲突时等 5s 而非立即报错
        cursor.execute("PRAGMA synchronous=NORMAL")     # WAL 下安全且更快
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
