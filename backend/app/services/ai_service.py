import httpx
import logging
import time
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.models import ChatSession, ChatMessage

settings = get_settings()
logger = logging.getLogger(__name__)


async def chat_with_deepseek(messages: list, stream: bool = False, tools=None, tool_choice=None):
    """Call DeepSeek API（OpenAI 兼容协议，支持 function calling）。

    Args:
        messages: OpenAI 格式的消息列表。
        stream: 是否流式（当前项目未启用流式渲染）。
        tools: OpenAI function calling 的 tools 数组；传入即开启工具调用。
        tool_choice: 工具选择策略，默认 "auto"（仅当 tools 非空时生效）。
    """
    headers = {
        "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {"model": settings.DEEPSEEK_MODEL, "messages": messages, "stream": stream}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = tool_choice or "auto"

    # 脱敏：只记条数和总字符数，不记完整 prompt 内容
    total_chars = sum(len(m.get("content") or "") for m in messages)
    logger.info("[DeepSeek] 请求 model=%s messages=%d 总字符=%d tools=%s",
                settings.DEEPSEEK_MODEL, len(messages), total_chars, bool(tools))

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.DEEPSEEK_API_BASE}/chat/completions",
                headers=headers,
                json=payload,
                timeout=60.0,
            )
            elapsed_ms = (time.perf_counter() - start) * 1000
            response.raise_for_status()
            data = response.json()
            tokens_used = data.get("usage", {}).get("total_tokens", 0)
            logger.info("[DeepSeek] 成功 耗时=%.0fms tokens=%d", elapsed_ms, tokens_used)
            return {
                "choices": data.get("choices", []),
                "usage": {
                    "total_tokens": tokens_used,
                    "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                    "completion_tokens": data.get("usage", {}).get("completion_tokens", 0),
                }
            }
    except httpx.HTTPStatusError as e:
        # 关键：记录响应体（含 DeepSeek 返回的具体 error message，定位 400 的唯一证据）
        logger.error("[DeepSeek] HTTP %d 耗时=%.0fms 响应体=%s",
                     e.response.status_code,
                     (time.perf_counter() - start) * 1000,
                     e.response.text[:500])
        raise
    except Exception:
        logger.exception("[DeepSeek] 非HTTP异常 耗时=%.0fms",
                         (time.perf_counter() - start) * 1000)
        raise


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
        "output_format": "jpeg",
        "stream": False,
        "watermark": False,
    }

    logger.info("[Seedream] 请求 prompt长度=%d size=%s", len(prompt), payload.get("size"))
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://ark.cn-beijing.volces.com/api/v3/images/generations",
                headers=headers,
                json=payload,
                timeout=120.0,
            )
            elapsed_ms = (time.perf_counter() - start) * 1000
            response.raise_for_status()
            data = response.json()

            if "error" in data:
                logger.error("[Seedream] API业务错误 耗时=%.0fms error=%s", elapsed_ms, data['error'])
                raise ValueError(f"Seedream API error: {data['error']}")

            if "data" in data and len(data["data"]) > 0:
                image_data = data["data"][0]
                if "error" in image_data:
                    logger.error("[Seedream] 图片生成错误 耗时=%.0fms error=%s", elapsed_ms, image_data['error'])
                    raise ValueError(f"Image generation failed: {image_data['error']}")
                logger.info("[Seedream] 成功 耗时=%.0fms", elapsed_ms)
                return {"image_url": image_data.get("url"), "size": image_data.get("size")}

            logger.error("[Seedream] 响应无图片数据 耗时=%.0fms 响应体=%s", elapsed_ms, str(data)[:500])
            raise ValueError("No image data in response")
    except httpx.HTTPStatusError as e:
        logger.error("[Seedream] HTTP %d 耗时=%.0fms 响应体=%s",
                     e.response.status_code,
                     (time.perf_counter() - start) * 1000,
                     e.response.text[:500])
        raise
    except Exception:
        logger.exception("[Seedream] 非HTTP异常 耗时=%.0fms",
                         (time.perf_counter() - start) * 1000)
        raise
