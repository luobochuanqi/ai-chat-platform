"""Skill 基类与注册表。

定义统一的 Skill 接口，供 function-calling 循环按名调用。
每个 skill 是一个受控工具：AI 通过 function calling 传参，服务端执行白名单内的运算。
"""
from abc import ABC, abstractmethod
from typing import Any


class BaseSkill(ABC):
    """Skill 抽象基类。

    一个 skill = 一个可被 AI 通过 function calling 调用的受控工具。
    子类需实现 name / description / parameters / execute 四个成员。
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """function calling 的函数名，全局唯一标识本 skill。"""
        raise NotImplementedError

    @property
    @abstractmethod
    def description(self) -> str:
        """告诉 AI「何时该调用本 skill」的自然语言描述。"""
        raise NotImplementedError

    @property
    @abstractmethod
    def parameters(self) -> dict:
        """OpenAI function calling 的 parameters，JSON Schema 格式。"""
        raise NotImplementedError

    @abstractmethod
    async def execute(self, args: dict) -> str:
        """执行 skill，返回喂给 AI 的文本结果。

        参数缺失或非法应抛异常（遵循「不兜底默认值」红线），由调用方处理。
        """
        raise NotImplementedError

    def to_openai_tool(self) -> dict:
        """转成 OpenAI / DeepSeek function calling 的 tools 数组元素格式。"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class SkillRegistry:
    """Skill 注册表，唯一的 skill 执行入口。

    集中处理「未注册 skill」「参数非法」等错误，显式抛异常，不做静默兜底。
    """

    def __init__(self) -> None:
        self._skills: dict[str, BaseSkill] = {}

    def register(self, skill: BaseSkill) -> None:
        """注册一个 skill。名称冲突时抛异常，避免静默覆盖。"""
        if skill.name in self._skills:
            raise ValueError(f"Skill 已注册，名称冲突: {skill.name}")
        self._skills[skill.name] = skill

    def get(self, name: str) -> BaseSkill:
        """按名获取 skill。未注册时抛 KeyError，不返回 None 兜底。"""
        if name not in self._skills:
            raise KeyError(f"未注册的 skill: {name}")
        return self._skills[name]

    def list_names(self) -> list[str]:
        """返回所有已注册 skill 的名称。"""
        return list(self._skills.keys())

    def get_openai_tools(self, names: list[str]) -> list[dict]:
        """把指定 skills 转成 OpenAI tools 参数格式；未注册名会抛 KeyError。"""
        return [self.get(n).to_openai_tool() for n in names]

    async def execute(self, name: str, args: dict) -> str:
        """执行指定 skill。未注册 / 参数错误会显式抛异常。"""
        skill = self.get(name)
        return await skill.execute(args)


# 全局单例：整个应用共用一个注册表
SKILL_REGISTRY = SkillRegistry()
