"""Skills 包：注册表与内置 skill。

导入本包即自动注册三个内置 skill（calculator / datetime / random）。
使用方：`from app.skills import SKILL_REGISTRY`。
"""
from app.skills.base import BaseSkill, SkillRegistry
from app.skills.base import SKILL_REGISTRY
from app.skills.calculator import calculator_skill
from app.skills.datetime_skill import datetime_skill
from app.skills.random_skill import random_skill

# 集中注册：本 __init__ 只在首次导入时执行一次，不会重复注册
SKILL_REGISTRY.register(calculator_skill)
SKILL_REGISTRY.register(datetime_skill)
SKILL_REGISTRY.register(random_skill)

__all__ = ["BaseSkill", "SkillRegistry", "SKILL_REGISTRY"]
