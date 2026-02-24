"""
调研工具注册系统
提供可插拔的调研工具，支持灵活配置调研步骤
"""
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
import json
import os

__all__ = ['ResearchTool', 'ResearchToolRegistry']

# 配置文件路径
TOOLS_CONFIG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "data",
    "tools_config.json"
)


@dataclass
class ResearchTool:
    """调研工具基类"""
    tool_id: str
    tool_name: str
    category: str  # "data_extraction", "chart_creation", "product_research", "report_creation"
    description: str
    icon: str = ""
    input_schema: Dict[str, str] = field(default_factory=dict)
    output_schema: Dict[str, str] = field(default_factory=dict)
    config: Dict[str, Any] = field(default_factory=dict)
    executor: Optional[Callable] = None

    # 数据来源配置
    data_source_type: str = "database"  # "database" | "web_crawl" | "both"
    databases: List[str] = field(default_factory=list)  # 数据库列表，如 ["fact", "ipmdata"]
    crawl_urls: List[str] = field(default_factory=list)  # 爬取URL列表

    # 预置问题
    preset_questions: List[str] = field(default_factory=list)

    # 调用模型
    model: str = "deep"  # "fast" | "deep" | "image"

    # 时间范围配置
    time_range_enabled: bool = False
    default_time_range: int = 365  # 默认天数

    # 输出内容类型
    output_types: List[str] = field(default_factory=lambda: ["markdown"])  # "markdown" | "html" | "chart" | "table" | "insight"

    # 系统提示词
    system_prompt: str = ""

    # 字段可见性配置（控制在画布工具箱中显示哪些字段）
    visible_fields: Dict[str, bool] = field(default_factory=lambda: {
        "tool_name": True,
        "description": True,
        "databases": True,
        "crawl_urls": True,
        "preset_questions": True,
        "model": True,
        "time_range": True,
        "output_types": True,
        "system_prompt": True,
    })

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "tool_id": self.tool_id,
            "tool_name": self.tool_name,
            "category": self.category,
            "description": self.description,
            "icon": self.icon,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
            "config": self.config,
            "data_source_type": self.data_source_type,
            "databases": self.databases,
            "crawl_urls": self.crawl_urls,
            "preset_questions": self.preset_questions,
            "model": self.model,
            "time_range_enabled": self.time_range_enabled,
            "default_time_range": self.default_time_range,
            "output_types": self.output_types,
            "system_prompt": self.system_prompt,
            "visible_fields": self.visible_fields,
        }


class ResearchToolRegistry:
    """调研工具注册表"""
    _tools: Dict[str, ResearchTool] = {}

    @classmethod
    def register(cls, tool: ResearchTool):
        """注册工具"""
        cls._tools[tool.tool_id] = tool
        print(f"[ResearchToolRegistry] 注册工具: {tool.tool_name} ({tool.tool_id})")

    @classmethod
    def load_config(cls) -> Dict[str, Any]:
        """从文件加载工具配置"""
        if not os.path.exists(TOOLS_CONFIG_FILE):
            return {}
        try:
            with open(TOOLS_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[ResearchToolRegistry] 加载配置失败: {e}")
            return {}

    @classmethod
    def save_config(cls):
        """保存工具配置到文件"""
        try:
            os.makedirs(os.path.dirname(TOOLS_CONFIG_FILE), exist_ok=True)
            config = {tool_id: tool.to_dict() for tool_id, tool in cls._tools.items()}
            with open(TOOLS_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            print(f"[ResearchToolRegistry] 配置已保存到 {TOOLS_CONFIG_FILE}")
        except Exception as e:
            print(f"[ResearchToolRegistry] 保存配置失败: {e}")

    @classmethod
    def get_tool(cls, tool_id: str) -> Optional[ResearchTool]:
        """获取工具"""
        return cls._tools.get(tool_id)

    @classmethod
    def list_tools(cls, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """列出所有工具"""
        tools = cls._tools.values()
        if category:
            tools = [t for t in tools if t.category == category]
        return [t.to_dict() for t in tools]

    @classmethod
    def get_categories(cls) -> List[str]:
        """获取所有工具分类"""
        categories = set(t.category for t in cls._tools.values())
        return sorted(list(categories))

    @classmethod
    def update_tool(cls, tool_id: str, updates: Dict[str, Any]) -> bool:
        """更新工具配置"""
        tool = cls._tools.get(tool_id)
        if not tool:
            return False

        # 更新允许的字段
        allowed_fields = [
            'tool_name', 'category', 'description', 'icon', 'input_schema', 'output_schema', 'config',
            'data_source_type', 'databases', 'crawl_urls', 'preset_questions',
            'model', 'time_range_enabled', 'default_time_range', 'output_types', 'system_prompt',
            'visible_fields'
        ]

        for field, value in updates.items():
            if field in allowed_fields and hasattr(tool, field):
                setattr(tool, field, value)

        print(f"[ResearchToolRegistry] 更新工具: {tool.tool_name} ({tool_id})")

        # 保存配置到文件
        cls.save_config()

        return True

    @classmethod
    def create_tool(cls, tool_data: Dict[str, Any]) -> bool:
        """创建新工具"""
        try:
            tool = ResearchTool(**tool_data)
            cls._tools[tool.tool_id] = tool
            print(f"[ResearchToolRegistry] 创建工具: {tool.tool_name} ({tool.tool_id})")

            # 保存配置到文件
            cls.save_config()
            return True
        except Exception as e:
            print(f"[ResearchToolRegistry] 创建工具失败: {e}")
            return False

    @classmethod
    def delete_tool(cls, tool_id: str) -> bool:
        """删除工具"""
        if tool_id not in cls._tools:
            return False

        tool_name = cls._tools[tool_id].tool_name
        del cls._tools[tool_id]
        print(f"[ResearchToolRegistry] 删除工具: {tool_name} ({tool_id})")

        # 保存配置到文件
        cls.save_config()
        return True
