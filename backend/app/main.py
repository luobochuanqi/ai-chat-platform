from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os
import logging
import uuid
from app.core.config import get_settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.models import User, SystemPrompt
from app.api import users, chat, images, admin, prompts
from app.prompts.image_gen_assistant import IMAGE_GEN_ASSISTANT_PROMPT

# 日志初始化（尽早执行，确保后续模块的 getLogger 输出到统一格式）
settings = get_settings()
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# 生产环境日志落盘（设 LOG_FILE 环境变量启用，如 /app/data/logs/app.log）
if settings.LOG_FILE:
    os.makedirs(os.path.dirname(settings.LOG_FILE), exist_ok=True)
    fh = logging.FileHandler(settings.LOG_FILE, encoding="utf-8")
    fh.setLevel(settings.LOG_LEVEL)
    fh.setFormatter(logging.root.handlers[0].formatter)
    logging.root.addHandler(fh)
    logger.info("日志文件已启用: %s", settings.LOG_FILE)

# Create tables
Base.metadata.create_all(bind=engine)

# Create upload directory
os.makedirs("./data/images", exist_ok=True)

# Create default admin user if not exists
def create_default_admin():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "admin").first()
        if not existing:
            admin_user = User(
                username="admin",
                nickname="管理员",
                hashed_password=get_password_hash("admin123"),
                is_admin=True,
                is_active=True,
                chat_quota=999999,
                image_quota=999999
            )
            db.add(admin_user)
            db.commit()
            logger.info("Default admin created: admin / admin123")
    except Exception as e:
        logger.error("Error creating default admin: %s", e)
    finally:
        db.close()

# Create default system prompts if not exists
def create_default_prompts():
    db = SessionLocal()
    try:
        existing = db.query(SystemPrompt).filter(SystemPrompt.is_builtin == True).first()
        if not existing:
            defaults = [
                SystemPrompt(
                    name="通用助手",
                    description="通用的AI助手，能回答各种问题",
                    prompt="你是一个有用且友好的AI助手。请用简洁清晰的中文回答问题，适当使用Markdown格式。",
                    is_builtin=True,
                    is_active=True
                ),
                SystemPrompt(
                    name="编程导师",
                    description="擅长编程的AI导师，可以帮你写代码、debug、解释概念",
                    prompt="你是一个经验丰富的编程导师。请用中文回答，代码注释用英文或中文。解释代码逻辑时请详细说明，提供最佳实践建议。代码块请用Markdown代码块格式。",
                    is_builtin=True,
                    is_active=True
                ),
                SystemPrompt(
                    name="创意写作",
                    description="擅长创意写作的AI，可以帮你写故事、诗歌、文案",
                    prompt="你是一位富有创意的写作助手。请用优美的中文写作，注重文采和创意。可以写故事、诗歌、文案等。回复时保持文学性和趣味性。",
                    is_builtin=True,
                    is_active=True
                ),
                SystemPrompt(
                    name="学习辅导",
                    description="面向初中生的学习辅导AI",
                    prompt="你是一位耐心细致的学习辅导老师，面向初中生。请用简单易懂的语言解释知识点，多举例说明。鼓励学生思考，引导他们自己找到答案，而不是直接给出答案。",
                    is_builtin=True,
                    is_active=True
                ),
                SystemPrompt(
                    name="生图提示词助教",
                    description="帮你一步步完善AI生图提示词，从主体到光影，让画面更出彩",
                    prompt=IMAGE_GEN_ASSISTANT_PROMPT,
                    is_builtin=True,
                    is_active=True,
                    tags=["生图", "创意"],
                ),
            ]
            for p in defaults:
                db.add(p)
            db.commit()
            logger.info("Created %d default system prompts", len(defaults))
    except Exception as e:
        logger.error("Error creating default prompts: %s", e)
    finally:
        db.close()

create_default_admin()
create_default_prompts()

app = FastAPI(title="AI Chat Platform", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(users.router)
app.include_router(chat.router)
app.include_router(images.router)
app.include_router(admin.router)
app.include_router(prompts.router)

# Static files for images
app.mount("/data/images", StaticFiles(directory="./data/images"), name="images")

@app.get("/")
def root():
    return {"message": "AI Chat Platform API"}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    """全局异常兜底：记录完整 traceback + traceId，前端只收友好文案（不泄漏内部细节）"""
    trace_id = uuid.uuid4().hex[:8]
    logger.exception("[trace_id=%s] 未处理异常 path=%s method=%s",
                     trace_id, request.url.path, request.method)
    return JSONResponse(
        status_code=500,
        content={"detail": f"服务器内部错误（trace_id: {trace_id}）"},
    )
