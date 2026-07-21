"""Random skill — 真随机。

填 LLM「给不了真随机」的洞：模型是确定性函数，掷骰子时倾向给出固定值；
本 skill 用 Python random 在服务端产生真随机。
"""
import random as _random

from app.skills.base import BaseSkill


class RandomSkill(BaseSkill):
    """真随机 skill：掷骰子 / 范围随机数 / 抽签。"""

    @property
    def name(self) -> str:
        return "random_generator"

    @property
    def description(self) -> str:
        return (
            "生成真随机数。当用户需要掷骰子、抽签、随机选择、"
            "生成指定范围的随机数时使用。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["dice", "number", "choice"],
                    "description": "随机类型：dice=掷骰子, number=范围随机数, choice=抽签",
                },
                "sides": {
                    "type": "integer",
                    "description": "骰子面数（action=dice 时），默认 6",
                },
                "minimum": {
                    "type": "integer",
                    "description": "随机数下限（action=number 时），默认 1",
                },
                "maximum": {
                    "type": "integer",
                    "description": "随机数上限（action=number 时），默认 100",
                },
                "choices": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "备选项目（action=choice 时），不可为空",
                },
            },
            "required": ["action"],
        }

    async def execute(self, args: dict) -> str:
        action = args.get("action")

        if action == "dice":
            sides = args.get("sides", 6)
            if not isinstance(sides, int) or isinstance(sides, bool) or sides < 1:
                raise ValueError(f"无效的骰子面数: {sides}")
            return f"掷骰子({sides}面)结果：{_random.randint(1, sides)}"

        if action == "number":
            low = args.get("minimum", 1)
            high = args.get("maximum", 100)
            if not (_is_int(low) and _is_int(high)) or low > high:
                raise ValueError(f"无效的随机数范围: [{low}, {high}]")
            return f"随机数({low}-{high})：{_random.randint(low, high)}"

        if action == "choice":
            choices = args.get("choices")
            if not choices or not isinstance(choices, list):
                raise ValueError("action=choice 需要非空 choices 列表")
            return f"抽签结果：{_random.choice(choices)}"

        raise ValueError(f"未知的 action: {action}（应为 dice / number / choice）")


def _is_int(value) -> bool:
    """判断是否为真正的 int（排除 bool，因为 bool 是 int 的子类）。"""
    return isinstance(value, int) and not isinstance(value, bool)


# 模块级单例，供注册表导入
random_skill = RandomSkill()
