"""
Skills 包
提供模块化的技能封装
"""

from .base import BaseSkill, SkillConfig, SkillResult
from .registry import SkillRegistry

__all__ = [
    "BaseSkill",
    "SkillConfig",
    "SkillResult",
    "SkillRegistry",
]
