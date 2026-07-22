"""skill_runner 循环引擎测试。

用 mock 替换 chat_with_deepseek，不依赖真实 API key / 网络，验证循环逻辑正确性。
运行：cd backend && python -m unittest tests.test_skill_runner -v
"""
import asyncio
import unittest
from unittest.mock import patch

from app.services import skill_runner
from app.services.skill_runner import run_chat_with_skills


def _resp_with_tool_call(name="calculator", arguments='{"expression": "1234 * 5678"}'):
    """模拟模型返回一个 tool_call。"""
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_1",
                            "type": "function",
                            "function": {"name": name, "arguments": arguments},
                        }
                    ],
                }
            }
        ],
        "usage": {"total_tokens": 50},
    }


def _resp_final(text="计算结果是 7006652", tokens=30):
    """模拟模型返回最终文本回复。"""
    return {
        "choices": [{"message": {"role": "assistant", "content": text}}],
        "usage": {"total_tokens": tokens},
    }


class TestRunChatWithSkills(unittest.TestCase):
    def _run(self, coro):
        return asyncio.run(coro)

    def test_no_skills_runs_plain_path(self):
        """空 skill_names 走普通调用，不传 tools。"""
        with patch.object(skill_runner, "chat_with_deepseek") as mock_api:
            mock_api.return_value = _resp_final("你好")
            content, log, tokens = self._run(
                run_chat_with_skills([{"role": "user", "content": "你好"}], [])
            )
        self.assertEqual(content, "你好")
        self.assertEqual(log, [])
        # 普通路径不应传 tools
        _, kwargs = mock_api.call_args
        self.assertNotIn("tools", kwargs)

    def test_one_tool_call_then_final(self):
        """一轮 tool_call 后正常回复：执行了 calculator 并终止。"""
        call_count = {"n": 0}

        def fake(messages, **kwargs):
            call_count["n"] += 1
            return _resp_with_tool_call() if call_count["n"] == 1 else _resp_final()

        with patch.object(skill_runner, "chat_with_deepseek", side_effect=fake):
            content, log, tokens = self._run(
                run_chat_with_skills(
                    [{"role": "user", "content": "1234*5678"}], ["calculator"]
                )
            )
        self.assertIn("7006652", content)
        self.assertEqual(len(log), 1)
        self.assertEqual(log[0]["name"], "calculator")
        self.assertTrue(log[0]["ok"])
        self.assertEqual(call_count["n"], 2)  # 第一次拿 tool_call，第二次拿最终回复
        # tokens 累加：50 + 30
        self.assertEqual(tokens, 80)

    def test_max_iterations_fallback(self):
        """模型一直返回 tool_calls，达到 MAX_ITERATIONS 兜底终止。"""
        with patch.object(
            skill_runner, "chat_with_deepseek", return_value=_resp_with_tool_call()
        ):
            content, log, tokens = self._run(
                run_chat_with_skills(
                    [{"role": "user", "content": "x"}], ["calculator"]
                )
            )
        self.assertEqual(content, skill_runner.ITERATION_LIMIT_MESSAGE)
        self.assertEqual(len(log), skill_runner.MAX_ITERATIONS)

    def test_skill_failure_does_not_crash(self):
        """未知 skill 执行失败，错误喂回模型，循环继续并最终回复。"""
        bad = _resp_with_tool_call(name="nonexistent_skill", arguments="{}")
        call_count = {"n": 0}

        def fake(messages, **kwargs):
            call_count["n"] += 1
            return bad if call_count["n"] == 1 else _resp_final("已处理该问题")

        with patch.object(skill_runner, "chat_with_deepseek", side_effect=fake):
            content, log, tokens = self._run(
                run_chat_with_skills(
                    [{"role": "user", "content": "x"}], ["calculator"]
                )
            )
        self.assertEqual(content, "已处理该问题")
        self.assertEqual(len(log), 1)
        self.assertFalse(log[0]["ok"])  # 标记失败
        self.assertIn("失败", log[0]["result"])

    def test_tools_passed_to_api(self):
        """启用 skill 时，tools 参数确实传给了 DeepSeek。"""
        with patch.object(skill_runner, "chat_with_deepseek") as mock_api:
            mock_api.return_value = _resp_final()
            self._run(
                run_chat_with_skills(
                    [{"role": "user", "content": "现在几点"}], ["get_current_time"]
                )
            )
        _, kwargs = mock_api.call_args
        self.assertIn("tools", kwargs)
        self.assertEqual(kwargs["tool_choice"], "auto")
        # tools 里应包含 get_current_time
        names = [t["function"]["name"] for t in kwargs["tools"]]
        self.assertIn("get_current_time", names)


if __name__ == "__main__":
    unittest.main()
