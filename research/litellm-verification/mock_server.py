"""本地 OpenAI 兼容 mock 服务,仅用于 litellm 集成事实验证。

启动: backend/.venv/Scripts/python.exe research/litellm-verification/mock_server.py
监听 127.0.0.1:8399。不访问任何真实模型 API。

行为约定(通过请求头 Authorization 区分):
- key "sk-good-1"  → 第 N 次返回 500/429(可配),之后仍失败(用于测 Router 换 key)
- key "sk-good-2"  → 正常 200
- 环境变量 MOCK_FAIL_USAGE=1 时省略 usage 字段
"""
import json
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

FAIL_STATUS = int(os.environ.get("MOCK_FAIL_STATUS", "429"))  # 429 或 500
OMIT_USAGE = os.environ.get("MOCK_FAIL_USAGE") == "1"

request_log: list[dict] = []


def make_response(req: dict) -> dict:
    """若最后一条 assistant 带未应答 tool_calls,则给最终文本;否则请求调用工具。"""
    msgs = req.get("messages", [])
    # 已有 tool 结果回喂 → 返回文本,结束循环
    if any(m.get("role") == "tool" for m in msgs):
        content = f"工具结果已收到,共 {len(msgs)} 条消息。"
        tool_calls = None
    else:
        content = None
        tool_calls = [
            {
                "id": "call_mock_001",
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "arguments": json.dumps({"city": req.get("mock_city", "北京")},
                                            ensure_ascii=False),
                },
            }
        ]
    resp = {
        "id": "chatcmpl-mock",
        "object": "chat.completion",
        "created": 1700000000,
        "model": req.get("model", "mock-model"),
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                    **({"tool_calls": tool_calls} if tool_calls else {}),
                },
                "finish_reason": "tool_calls" if tool_calls else "stop",
            }
        ],
    }
    if not OMIT_USAGE:
        prompt_t = sum(len(json.dumps(m, ensure_ascii=False)) for m in msgs) // 4 + 10
        resp["usage"] = {
            "prompt_tokens": prompt_t,
            "completion_tokens": 20,
            "total_tokens": prompt_t + 20,
        }
    return resp


@app.post("/v1/chat/completions")
@app.post("/chat/completions")
async def chat_completions(request: Request):
    auth = request.headers.get("authorization", "")
    key = auth.removeprefix("Bearer ").strip()
    req = await request.json()
    request_log.append({"key_tail": key[-2:], "model": req.get("model"),
                        "n_messages": len(req.get("messages", []))})

    if key == "sk-bad-key":
        # 模拟上游持续故障,供 Router 测换 key
        return JSONResponse(
            {"error": {"message": "mock rate limited", "type": "rate_limit_error"}},
            status_code=FAIL_STATUS,
            headers={"retry-after": "1"} if FAIL_STATUS == 429 else {},
        )

    return JSONResponse(make_response(req))


@app.get("/_log")
async def log():
    return {"count": len(request_log), "entries": request_log}



@app.get("/_log_reset")
async def log_reset():
    request_log.clear()
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8399, log_level="warning")

