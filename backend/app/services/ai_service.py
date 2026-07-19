import httpx
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.models import ChatSession, ChatMessage

settings = get_settings()


async def chat_with_deepseek(messages: list, stream: bool = False):
    """Call DeepSeek API"""
    headers = {
        "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {"model": settings.DEEPSEEK_MODEL, "messages": messages, "stream": stream}

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.DEEPSEEK_API_BASE}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()
        
        # Extract usage info
        usage = data.get("usage", {})
        tokens_used = usage.get("total_tokens", 0)
        
        return {
            "choices": data.get("choices", []),
            "usage": {
                "total_tokens": tokens_used,
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
            }
        }


async def generate_image_seedream(prompt: str):
    """Call Seedream 5.0 Lite API via Volcano Engine"""
    settings = get_settings()
    if not settings.SEEDREAM_API_KEY:
        raise ValueError("Seedream API key not configured")

    headers = {
        "Authorization": f"Bearer {settings.SEEDREAM_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "doubao-seedream-5-0-260128",
        "prompt": prompt,
        "size": "2K",
        "response_format": "url",
        "sequential_image_generation": "disabled",
        "output_format": "jpeg",
        "stream": False,
        "watermark": False,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://ark.cn-beijing.volces.com/api/v3/images/generations",
            headers=headers,
            json=payload,
            timeout=120.0,
        )
        response.raise_for_status()
        data = response.json()

        if "error" in data:
            raise ValueError(f"Seedream API error: {data['error']}")

        if "data" in data and len(data["data"]) > 0:
            image_data = data["data"][0]
            if "error" in image_data:
                raise ValueError(f"Image generation failed: {image_data['error']}")
            return {"image_url": image_data.get("url"), "size": image_data.get("size")}

        raise ValueError("No image data in response")
