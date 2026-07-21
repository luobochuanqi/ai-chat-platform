"""Function-calling 循环引擎。

当会话启用 skills 时，把 skill 作为 tools 传给 DeepSeek（OpenAI 兼容）。
若模型返回 tool_calls，就执行对应 skill、把结果以 role="tool" 喂回模型，
再次调用，循环直到模型给出正常文本回复。

防死循环：最多 MAX_ITERATIONS 轮；单个 skill 执行失败不导致整体崩溃。
"""
import json
import logging

from app.services.ai_service import chat_with_deepseek
from app.skills import SKILL_REGISTRY

logger = logging.getLogger(__name__)

# 防死循环上限：模型若反复要求调用工具，到此轮次强制终止。
MAX_ITERATIONS = 5

# 达到上限时的兜底回复
ITERATION_LIMIT_MESSAGE = "（技能调用次数超出上限，已停止）"


async def run_chat_with_skills(
    messages: list, skill_names: list[str]
) -> tuple[str, list[dict], int]:
    """带 skill 的对话循环。

    Args:
        messages: 已拼好的 OpenAI 格式消息（含 system_prompt + 历史）。
            注意：本函数会**就地追加** assistant / tool 消息到该列表。
        skill_names: 本次启用的 skill 名称列表。

    Returns:
        (最终回复文本, tool 调用记录列表, 累计 tokens_used)。
        tool 调用记录每项形如 {"name", "args", "result", "ok"}。
    """
    # 防御性兜底：无 skill 不应进入本函数，走普通调用
    if not skill_names:
        response = await chat_with_deepseek(messages)
        content = response["choices"][0]["message"].get("content") or ""
        tokens = response.get("usage", {}).get("total_tokens", 0)
        return content, [], tokens

    tools = SKILL_REGISTRY.get_openai_tools(skill_names)
    tool_call_log: list[dict] = []
    total_tokens = 0

    for _ in range(MAX_ITERATIONS):
        response = await chat_with_deepseek(
            messages, tools=tools, tool_choice="auto"
        )
        total_tokens += response.get("usage", {}).get("total_tokens", 0)
        message = response["choices"][0]["message"]
        tool_calls = message.get("tool_calls")

        # 模型给出最终文本回复，结束循环
        if not tool_calls:
            content = message.get("content") or ""
            return content, tool_call_log, total_tokens

        # OpenAI 协议要求：含 tool_calls 的 assistant 消息需原样回传
        messages.append(message)

        # 逐个执行 skill，结果以 role="tool" 喂回
        for tool_call in tool_calls:
            executed = await _execute_one_tool(tool_call)
            tool_call_log.append(executed["log"])
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id"),
                    "content": executed["content"],
                }
            )

    # 兜底：达到最大轮次模型仍在要求调用工具
    logger.warning(
        "skill 循环达到最大轮次 %d，强制终止（可能存在死循环）", MAX_ITERATIONS
    )
    return ITERATION_LIMIT_MESSAGE, tool_call_log, total_tokens


async def _execute_one_tool(tool_call: dict) -> dict:
    """执行单个 tool_call，返回喂给模型的内容与日志记录。

    单个 skill 失败时不抛异常，而是把错误信息作为 content 喂回模型，
    让模型有机会向用户解释，避免一次工具失败导致整个对话 500。
    """
    function = tool_call.get("function", {}) or {}
    name = function.get("name", "")
    raw_args = function.get("arguments", "{}")

    try:
        args = json.loads(raw_args) if raw_args else {}
    except json.JSONDecodeError:
        logger.warning("tool_call 参数不是合法 JSON: %s", raw_args)
        args = {}

    try:
        result_text = await SKILL_REGISTRY.execute(name, args)
        return {
            "content": result_text,
            "log": {"name": name, "args": args, "result": result_text, "ok": True},
        }
    except Exception as exc:  # noqa: BLE001 — 单点失败要降级而非崩溃
        logger.exception("skill 执行失败: %s", name)
        content = f"（技能 {name} 执行失败：{exc}）"
        return {
            "content": content,
            "log": {"name": name, "args": args, "result": content, "ok": False},
        }
