"""litellm 事实验证脚本(对照 mock_server.py)。

运行:
  backend/.venv/Scripts/python.exe research/litellm-verification/mock_server.py &  (另一终端)
  backend/.venv/Scripts/python.exe research/litellm-verification/run_checks.py
"""
import asyncio
import json
import time

import litellm
from litellm import Router

BASE = "http://127.0.0.1:8399"
TOOLS = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "查询城市天气",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]
MSGS = [{"role": "user", "content": "北京天气怎么样?"}]


def section(title):
    print(f"\n===== {title} =====")


async def check1_tools_and_shape():
    section("1. tools 透传与响应结构")
    resp = await litellm.acompletion(
        model="openai/gpt-mock", api_base=BASE + "/v1", api_key="sk-ok",
        messages=list(MSGS), tools=TOOLS, tool_choice="auto",
    )
    print("返回类型:", type(resp).__name__)
    msg = resp.choices[0].message  # 属性访问
    tc = msg.tool_calls[0]
    print("tool_calls[0].function.name:", tc.function.name)
    print("tool_calls[0].function.arguments:", tc.function.arguments)
    print("tool_call id:", tc.id, "| type:", tc.type)

    # 字典式访问(现有 skill_runner.py 的写法)是否可用?
    try:
        d = resp["choices"][0]["message"]["tool_calls"][0]["function"]["name"]
        print('dict 下标访问 resp["choices"]...:', "OK ->", d)
    except Exception as e:
        print('dict 下标访问失败:', type(e).__name__, e)
    try:
        g = resp.get("usage")
        print("resp.get('usage'):", "OK" if g is not None else "None")
    except AttributeError as e:
        print("resp.get 不存在:", e)
    print("model_dump() 可用:", hasattr(resp, "model_dump"))

    # role="tool" 回喂 + 第二轮
    messages = list(MSGS)
    messages.append(msg.model_dump())
    messages.append({"role": "tool", "tool_call_id": tc.id,
                     "content": json.dumps({"temp_c": 3}, ensure_ascii=False)})
    resp2 = await litellm.acompletion(
        model="openai/gpt-mock", api_base=BASE + "/v1", api_key="sk-ok",
        messages=messages, tools=TOOLS, tool_choice="auto",
    )
    m2 = resp2.choices[0].message
    print("第二轮 content:", m2.content)
    print("第二轮 tool_calls:", m2.tool_calls)
    u = resp2.usage
    print(f"usage.total_tokens={u.total_tokens} prompt={u.prompt_tokens} completion={u.completion_tokens}")
    # usage 是否可 dict 访问(skill_runner 写法)
    try:
        _ = resp2.get("usage").get("total_tokens")
        print("usage .get() 链式访问: OK")
    except AttributeError as e:
        print("usage .get() 链式访问失败:", e)


async def check2_router():
    section("2. Router 多 Key 轮换/重试")
    router = Router(
        model_list=[
            {"model_name": "gpt-mock",
             "litellm_params": {"model": "openai/gpt-mock",
                                "api_base": BASE + "/v1", "api_key": "sk-bad-key"}},
            {"model_name": "gpt-mock",
             "litellm_params": {"model": "openai/gpt-mock",
                                "api_base": BASE + "/v1", "api_key": "sk-good-2"}},
        ],
        num_retries=2,
        retry_after=1,
        fallbacks=[{"gpt-mock": ["gpt-mock"]}],
    )
    t0 = time.monotonic()
    resp = await router.acompletion(model="gpt-mock", messages=list(MSGS))
    dt = time.monotonic() - t0
    msg = resp.choices[0].message
    print(f"成功,耗时 {dt:.2f}s;content={msg.content!r} tool_calls={msg.tool_calls is not None}")
    import httpx
    log = httpx.get(BASE + "/_log").json()
    keys_seen = [e["key_tail"] for e in log["entries"]]
    print("mock 收到的请求 key 序列(尾2位):", keys_seen)


async def check3_usage_missing():
    section("3. usage 缺失时的行为(mock 省略 usage)")
    resp = await litellm.acompletion(
        model="openai/gpt-mock", api_base=BASE + "/v1", api_key="sk-ok",
        messages=list(MSGS),
    )
    u = resp.usage
    print("usage 对象:", repr(u)[:200])
    try:
        tt = u.total_tokens
        print("total_tokens 访问值:", tt)
    except Exception as e:
        print("访问 total_tokens 异常:", type(e).__name__, e)
    d = resp.model_dump()
    print("model_dump()['usage']:", d["usage"])
    # skill_runner 兼容写法
    try:
        v = resp.get("usage", {}).get("total_tokens", 0)
        print('skill_runner 式 response.get("usage",{}).get(...):', v)
    except AttributeError as e:
        print("skill_runner 式访问失败:", type(e).__name__, "-", e)


async def main():
    print("litellm version:", getattr(litellm, "__version__", None) or
          __import__("importlib.metadata", fromlist=["version"]) and
          __import__("importlib.metadata", fromlist=["version"]).version("litellm"))
    await check1_tools_and_shape()
    await check3_usage_missing()
    await check2_router()

if __name__ == "__main__":
    asyncio.run(main())
