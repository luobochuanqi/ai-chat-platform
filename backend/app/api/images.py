from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import httpx
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin
from app.core.config import get_settings
from app.models.schemas import *
from app.models.models import GeneratedImage, ImageLike, User
from app.services.ai_service import generate_image_seedream
import uuid
import os
import re

router = APIRouter(prefix="/images", tags=["images"])
settings = get_settings()


def _get_full_image_url(image_path: str) -> str:
    """Convert local image path to full URL"""
    if not image_path:
        return ""
    # If already a full URL, return as is
    if image_path.startswith("http://") or image_path.startswith("https://"):
        return image_path
    # If starts with /data/images/, prepend the API base
    if image_path.startswith("/data/images/"):
        return image_path
    return image_path


@router.post("/generate", response_model=ImageResponse)
async def generate_image(
    request: ImageGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check quota
    if current_user.image_used >= current_user.image_quota:
        raise HTTPException(status_code=403, detail="Image generation quota exceeded")

    prompt = request.prompt

    try:
        result = await generate_image_seedream(prompt)
        image_url = result.get("image_url")

        if not image_url:
            raise HTTPException(
                status_code=500, detail="Failed to generate image: no URL returned"
            )

        # Download and save the image locally
        import aiofiles

        image_filename = f"{uuid.uuid4()}.jpeg"
        local_path = os.path.join("./data/images", image_filename)

        async with httpx.AsyncClient() as client:
            img_response = await client.get(image_url, timeout=60.0)
            img_response.raise_for_status()
            async with aiofiles.open(local_path, "wb") as f:
                await f.write(img_response.content)

        # Store local path
        image_path = f"/data/images/{image_filename}"

        image = GeneratedImage(
            user_id=current_user.id,
            prompt=prompt,
            image_url=image_path,
            is_public=False,
        )
        db.add(image)
        current_user.image_used += 1
        db.commit()
        db.refresh(image)

        return {
            "id": image.id,
            "prompt": image.prompt,
            "image_url": _get_full_image_url(image.image_url),
            "is_public": image.is_public,
            "likes": image.likes,
            "created_at": image.created_at,
            "user_nickname": current_user.nickname,
            "is_liked": False,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation error: {str(e)}")


@router.get("/gallery", response_model=List[ImageResponse])
def get_gallery(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    images = (
        db.query(GeneratedImage)
        .filter(GeneratedImage.is_public == True)
        .order_by(GeneratedImage.created_at.desc())
        .all()
    )
    result = []
    for img in images:
        user = db.query(User).filter(User.id == img.user_id).first()
        # Check if current user liked this image
        liked = (
            db.query(ImageLike)
            .filter(ImageLike.image_id == img.id, ImageLike.user_id == current_user.id)
            .first()
        )
        result.append(
            {
                "id": img.id,
                "prompt": img.prompt,
                "image_url": _get_full_image_url(img.image_url),
                "is_public": img.is_public,
                "likes": img.likes,
                "created_at": img.created_at,
                "user_nickname": user.nickname if user else "Unknown",
                "is_liked": bool(liked),
            }
        )
    return result


@router.get("/my", response_model=List[ImageResponse])
def get_my_images(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    images = (
        db.query(GeneratedImage)
        .filter(GeneratedImage.user_id == current_user.id)
        .order_by(GeneratedImage.created_at.desc())
        .all()
    )
    result = []
    for img in images:
        result.append(
            {
                "id": img.id,
                "prompt": img.prompt,
                "image_url": _get_full_image_url(img.image_url),
                "is_public": img.is_public,
                "likes": img.likes,
                "created_at": img.created_at,
                "user_nickname": current_user.nickname,
                "is_liked": False,
            }
        )
    return result


@router.post("/like")
def like_image(
    request: ImageLikeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(ImageLike)
        .filter(
            ImageLike.image_id == request.image_id, ImageLike.user_id == current_user.id
        )
        .first()
    )

    if existing:
        # Unlike: remove the like
        db.delete(existing)
        image = (
            db.query(GeneratedImage)
            .filter(GeneratedImage.id == request.image_id)
            .first()
        )
        if image and image.likes > 0:
            image.likes -= 1
        db.commit()
        return {
            "message": "Unliked",
            "liked": False,
            "likes": image.likes if image else 0,
        }
    else:
        # Like: add new like
        like = ImageLike(image_id=request.image_id, user_id=current_user.id)
        db.add(like)
        image = (
            db.query(GeneratedImage)
            .filter(GeneratedImage.id == request.image_id)
            .first()
        )
        if image:
            image.likes += 1
        db.commit()
        return {"message": "Liked", "liked": True, "likes": image.likes if image else 0}


@router.put("/{image_id}/publish")
def publish_image(
    image_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    image.is_public = True
    db.commit()
    db.refresh(image)
    return {"message": "Image published"}


@router.put("/{image_id}/unpublish")
def unpublish_image(
    image_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    image.is_public = False
    db.commit()
    db.refresh(image)
    return {"message": "Image unpublished"}


@router.get("/admin/all")
def get_all_images(
    db: Session = Depends(get_db), admin: User = Depends(get_current_admin)
):
    images = db.query(GeneratedImage).order_by(GeneratedImage.created_at.desc()).all()
    result = []
    for img in images:
        user = db.query(User).filter(User.id == img.user_id).first()
        result.append(
            {
                "id": img.id,
                "prompt": img.prompt,
                "image_url": _get_full_image_url(img.image_url),
                "is_public": img.is_public,
                "likes": img.likes,
                "created_at": img.created_at,
                "user_nickname": user.nickname if user else "Unknown",
                "is_liked": False,
            }
        )
    return result


@router.post("/batch-publish")
def batch_publish(
    request: BatchImageRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    updated = 0
    for image_id in request.image_ids:
        image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
        if image:
            image.is_public = True
            updated += 1
    db.commit()
    return {"message": f"Published {updated} images"}


@router.post("/batch-unpublish")
def batch_unpublish(
    request: BatchImageRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    updated = 0
    for image_id in request.image_ids:
        image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
        if image:
            image.is_public = False
            updated += 1
    db.commit()
    return {"message": f"Unpublished {updated} images"}
