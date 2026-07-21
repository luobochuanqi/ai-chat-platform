"""Skills 单元测试。

运行：cd backend && python -m unittest tests.test_skills -v
"""
import asyncio
import re
import unittest

from app.skills import SKILL_REGISTRY
from app.skills.calculator import safe_eval


def _run(coro):
    """同步运行协程的测试辅助函数。"""
    return asyncio.run(coro)


class TestSafeEval(unittest.TestCase):
    """安全求值器：正确性 + 注入防护（安全关键）。"""

    def test_basic_arithmetic(self):
        self.assertEqual(safe_eval("1 + 2"), 3)
        self.assertEqual(safe_eval("(3 + 4) * 2"), 14)
        self.assertEqual(safe_eval("1234 * 5678"), 7006652)

    def test_power_and_mod(self):
        self.assertEqual(safe_eval("2 ** 10"), 1024)
        self.assertEqual(safe_eval("10 % 3"), 1)

    def test_unary(self):
        self.assertEqual(safe_eval("-5 + 3"), -2)
        self.assertEqual(safe_eval("+7"), 7)

    def test_decimal(self):
        self.assertAlmostEqual(safe_eval("1.5 + 2.5"), 4.0)

    def test_reject_name_injection(self):
        """任何变量名 / 函数调用都必须被拒绝。"""
        for evil in ["__import__('os')", "open('x')", "os.system('ls')", "abc"]:
            with self.assertRaises(ValueError):
                safe_eval(evil)

    def test_reject_syntax_error(self):
        with self.assertRaises(ValueError):
            safe_eval("1 +")

    def test_reject_huge_power(self):
        with self.assertRaises(ValueError):
            safe_eval("9 ** 9999")


class TestCalculatorSkill(unittest.TestCase):
    def test_correct_result(self):
        result = _run(SKILL_REGISTRY.execute("calculator", {"expression": "1234 * 5678"}))
        self.assertIn("7006652", result)

    def test_integer_no_decimal_suffix(self):
        result = _run(SKILL_REGISTRY.execute("calculator", {"expression": "4 / 2"}))
        self.assertIn("= 2", result)
        self.assertNotIn("2.0", result)

    def test_missing_arg_raises(self):
        with self.assertRaises(ValueError):
            _run(SKILL_REGISTRY.execute("calculator", {}))


class TestDatetimeSkill(unittest.TestCase):
    def test_returns_current_time(self):
        result = _run(SKILL_REGISTRY.execute("get_current_time", {}))
        self.assertIn("当前时间", result)
        self.assertIn("星期", result)


class TestRandomSkill(unittest.TestCase):
    def test_dice_in_range(self):
        for _ in range(20):
            result = _run(SKILL_REGISTRY.execute(
                "random_generator", {"action": "dice", "sides": 6}))
            nums = re.findall(r"\d+", result)
            self.assertTrue(nums)
            self.assertTrue(1 <= int(nums[-1]) <= 6)

    def test_number_in_range(self):
        for _ in range(20):
            result = _run(SKILL_REGISTRY.execute(
                "random_generator", {"action": "number", "minimum": 10, "maximum": 20}))
            nums = re.findall(r"\d+", result)
            self.assertTrue(nums)
            self.assertTrue(10 <= int(nums[-1]) <= 20)

    def test_choice(self):
        result = _run(SKILL_REGISTRY.execute(
            "random_generator", {"action": "choice", "choices": ["甲", "乙", "丙"]}))
        self.assertIn("抽签结果", result)

    def test_invalid_dice_sides(self):
        with self.assertRaises(ValueError):
            _run(SKILL_REGISTRY.execute(
                "random_generator", {"action": "dice", "sides": 0}))

    def test_invalid_action(self):
        with self.assertRaises(ValueError):
            _run(SKILL_REGISTRY.execute("random_generator", {"action": "xxx"}))

    def test_choice_empty_list(self):
        with self.assertRaises(ValueError):
            _run(SKILL_REGISTRY.execute(
                "random_generator", {"action": "choice", "choices": []}))


class TestRegistry(unittest.TestCase):
    def test_three_skills_registered(self):
        names = SKILL_REGISTRY.list_names()
        self.assertIn("calculator", names)
        self.assertIn("get_current_time", names)
        self.assertIn("random_generator", names)

    def test_unknown_skill_raises(self):
        with self.assertRaises(KeyError):
            SKILL_REGISTRY.get("nonexistent")

    def test_duplicate_register_raises(self):
        from app.skills.calculator import calculator_skill
        with self.assertRaises(ValueError):
            SKILL_REGISTRY.register(calculator_skill)

    def test_openai_tools_format(self):
        tools = SKILL_REGISTRY.get_openai_tools(["calculator"])
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["type"], "function")
        self.assertEqual(tools[0]["function"]["name"], "calculator")
        self.assertEqual(tools[0]["function"]["parameters"]["required"], ["expression"])


if __name__ == "__main__":
    unittest.main()
