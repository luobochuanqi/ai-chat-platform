from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.core.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.models import User
from app.api import users, chat, images, admin

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
            print("Default admin created: admin / admin123")
    except Exception as e:
        print(f"Error creating default admin: {e}")
    finally:
        db.close()

create_default_admin()

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

# Static files for images
app.mount("/data/images", StaticFiles(directory="./data/images"), name="images")

@app.get("/")
def root():
    return {"message": "AI Chat Platform API"}

@app.get("/health")
def health():
    return {"status": "ok"}
