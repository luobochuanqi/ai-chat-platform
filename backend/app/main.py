from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.core.database import engine, Base
from app.api import users, chat, images, admin

# Create tables
Base.metadata.create_all(bind=engine)

# Create upload directory
os.makedirs("./data/images", exist_ok=True)

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
