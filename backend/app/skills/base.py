"""
Skills 基础类定义
提供所有 skill 的基类和通用接口
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class SkillConfig(BaseModel):
    """Skill 配置基类"""
    name: str = Field(..., description="Skill 名称")
    description: str = Field(..., description="Skill 描述")
    version: str = Field(default="1.0.0", description="版本号")
    enabled: bool = Field(default=True, description="是否启用")


class SkillResult(BaseModel):
    """Skill 执行结果"""
    success: bool = Field(..., description="是否执行成功")
    data: Optional[Any] = Field(default=None, description="返回的数据")
    error: Optional[str] = Field(default=None, description="错误信息")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")


class BaseSkill(ABC):
    """所有 Skill 的基类"""

    def __init__(self, config: SkillConfig):
        self.config = config
        self._validate_config()

    @abstractmethod
    def execute(self, **kwargs) -> SkillResult:
        """
        执行 skill 的核心逻辑

        Args:
            **kwargs: 执行参数

        Returns:
            SkillResult: 执行结果
        """
        pass

    @abstractmethod
    def _validate_config(self):
        """验证配置是否有效"""
        pass

    def get_info(self) -> Dict[str, Any]:
        """
        获取 skill 信息

        Returns:
            Dict: skill 的基本信息
        """
        return {
            "name": self.config.name,
            "description": self.config.description,
            "version": self.config.version,
            "enabled": self.config.enabled
        }

    def __repr__(self):
        return f"<{self.__class__.__name__}(name={self.config.name}, version={self.config.version})>"
