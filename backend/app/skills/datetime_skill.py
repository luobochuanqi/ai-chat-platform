"""Datetime skill — 当前时间。

填 LLM「不知道现在是几点 / 今天星期几」的洞：模型无时钟、训练数据有截止日，
无法可靠回答「现在」相关的问题。本 skill 返回服务端真实时间。
"""
from datetime import datetime

from app.skills.base import BaseSkill

_WEEKDAYS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


class DatetimeSkill(BaseSkill):
    """当前时间 skill：返回日期、星期、时间。"""

    @property
    def name(self) -> str:
        return "get_current_time"

    @property
    def description(self) -> str:
        return (
            "获取当前的日期、时间、星期几。当用户问「今天星期几」「现在几点」"
            "「今天日期」「距离某天还有多久」等关于当前时间的问题时使用。"
        )

    @property
    def parameters(self) -> dict:
        return {"type": "object", "properties": {}}

    async def execute(self, args: dict) -> str:
        now = datetime.now()
        weekday = _WEEKDAYS[now.weekday()]
        return (
            f"当前时间：{now.strftime('%Y-%m-%d')} {weekday} "
            f"{now.strftime('%H:%M:%S')}"
        )


# 模块级单例，供注册表导入
datetime_skill = DatetimeSkill()
