"""
Skill 注册器
管理所有 skills 的注册、获取和执行
"""

from typing import Dict, Type, Optional, Any
from .base import BaseSkill, SkillResult, SkillConfig
import logging

logger = logging.getLogger(__name__)


class SkillRegistry:
    """Skill 注册器，管理所有可用的 skills"""

    _skills: Dict[str, Type[BaseSkill]] = {}
    _instances: Dict[str, BaseSkill] = {}

    @classmethod
    def register(cls, name: str):
        """
        装饰器：注册一个 skill

        Args:
            name: skill 的注册名称

        Example:
            @SkillRegistry.register("my_skill")
            class MySkill(BaseSkill):
                pass
        """
        def decorator(skill_class: Type[BaseSkill]):
            if name in cls._skills:
                logger.warning(f"Skill '{name}' already registered, overwriting...")
            cls._skills[name] = skill_class
            logger.info(f"Registered skill: {name}")
            return skill_class
        return decorator

    @classmethod
    def get_skill(cls, name: str, config: dict = None) -> Optional[BaseSkill]:
        """
        获取 skill 实例（单例模式）

        Args:
            name: skill 名称
            config: 配置字典（可选）

        Returns:
            BaseSkill 实例或 None
        """
        if name not in cls._skills:
            logger.error(f"Skill '{name}' not found")
            return None

        # 使用单例模式
        if name not in cls._instances:
            skill_class = cls._skills[name]
            try:
                cls._instances[name] = skill_class(config or {})
                logger.info(f"Initialized skill instance: {name}")
            except Exception as e:
                logger.error(f"Failed to initialize skill '{name}': {e}")
                return None

        return cls._instances[name]

    @classmethod
    def execute_skill(cls, name: str, **kwargs) -> SkillResult:
        """
        执行指定的 skill

        Args:
            name: skill 名称
            **kwargs: 传递给 skill.execute() 的参数

        Returns:
            SkillResult: 执行结果
        """
        skill = cls.get_skill(name)
        if not skill:
            return SkillResult(
                success=False,
                error=f"Skill '{name}' not found"
            )

        if not skill.config.enabled:
            return SkillResult(
                success=False,
                error=f"Skill '{name}' is disabled"
            )

        try:
            logger.info(f"Executing skill: {name}")
            result = skill.execute(**kwargs)
            logger.info(f"Skill '{name}' executed successfully")
            return result
        except Exception as e:
            logger.error(f"Skill '{name}' execution failed: {e}")
            return SkillResult(
                success=False,
                error=str(e)
            )

    @classmethod
    def list_skills(cls) -> Dict[str, Dict[str, Any]]:
        """
        列出所有已注册的 skills

        Returns:
            Dict: skill 名称到信息的映射
        """
        result = {}
        for name in cls._skills.keys():
            skill = cls.get_skill(name)
            if skill:
                result[name] = skill.get_info()
        return result

    @classmethod
    def clear_instances(cls):
        """清除所有 skill 实例（用于测试）"""
        cls._instances.clear()
        logger.info("Cleared all skill instances")
