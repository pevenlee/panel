# Skills 包设计方案

## 一、设计目标

将调研功能封装成独立的、可复用的 skills 包，实现：
- **模块化**：每个 skill 独立封装，职责单一
- **可扩展**：易于添加新的 skill
- **可配置**：支持灵活的参数配置
- **可测试**：每个 skill 可独立测试
- **可组合**：多个 skills 可以组合使用

---

## 二、Skills 包架构

### 2.1 目录结构

```
backend/
├── app/
│   ├── skills/                      # Skills 包根目录
│   │   ├── __init__.py              # 包初始化，导出所有 skills
│   │   ├── base.py                  # 基础 Skill 类
│   │   ├── registry.py              # Skill 注册器
│   │   │
│   │   ├── research/                # 调研相关 skills
│   │   │   ├── __init__.py
│   │   │   ├── plan_generator.py   # 调研计划生成
│   │   │   ├── data_collector.py   # 数据收集
│   │   │   ├── data_analyzer.py    # 数据分析
│   │   │   ├── report_generator.py # 报告生成
│   │   │   └── metadata_builder.py # 元数据构建
│   │   │
│   │   ├── dashboard/               # 看板相关 skills
│   │   │   ├── __init__.py
│   │   │   ├── chart_recommender.py # 图表推荐
│   │   │   ├── insight_generator.py # 洞察生成
│   │   │   └── data_refresher.py    # 数据刷新
│   │   │
│   │   └── common/                  # 通用 skills
│   │       ├── __init__.py
│   │       ├── query_executor.py    # 查询执行
│   │       ├── intent_classifier.py # 意图识别
│   │       └── code_executor.py     # 代码执行器
│   │
│   ├── main.py                      # FastAPI 主应用
│   ├── gemini_engine.py             # Gemini 引擎（逐步迁移）
│   └── engine.py                    # 规则引擎
│
└── tests/
    └── skills/                      # Skills 测试
        ├── test_research_skills.py
        └── test_dashboard_skills.py
```

---

## 三、核心类设计

### 3.1 基础 Skill 类

所有 skill 继承自 `BaseSkill`，提供统一的接口：

```python
# backend/app/skills/base.py

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pydantic import BaseModel

class SkillConfig(BaseModel):
    """Skill 配置基类"""
    name: str
    description: str
    version: str = "1.0.0"
    enabled: bool = True

class SkillResult(BaseModel):
    """Skill 执行结果"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = {}

class BaseSkill(ABC):
    """所有 Skill 的基类"""

    def __init__(self, config: SkillConfig):
        self.config = config
        self._validate_config()

    @abstractmethod
    def execute(self, **kwargs) -> SkillResult:
        """执行 skill 的核心逻辑"""
        pass

    @abstractmethod
    def _validate_config(self):
        """验证配置是否有效"""
        pass

    def get_info(self) -> Dict[str, Any]:
        """获取 skill 信息"""
        return {
            "name": self.config.name,
            "description": self.config.description,
            "version": self.config.version,
            "enabled": self.config.enabled
        }
```

### 3.2 Skill 注册器

管理所有 skills 的注册和调用：

```python
# backend/app/skills/registry.py

from typing import Dict, Type, Optional
from .base import BaseSkill, SkillResult

class SkillRegistry:
    """Skill 注册器，管理所有可用的 skills"""

    _skills: Dict[str, Type[BaseSkill]] = {}
    _instances: Dict[str, BaseSkill] = {}

    @classmethod
    def register(cls, name: str):
        """装饰器：注册一个 skill"""
        def decorator(skill_class: Type[BaseSkill]):
            cls._skills[name] = skill_class
            return skill_class
        return decorator

    @classmethod
    def get_skill(cls, name: str, config: dict = None) -> Optional[BaseSkill]:
        """获取 skill 实例"""
        if name not in cls._skills:
            return None

        # 使用单例模式
        if name not in cls._instances:
            skill_class = cls._skills[name]
            cls._instances[name] = skill_class(config or {})

        return cls._instances[name]

    @classmethod
    def execute_skill(cls, name: str, **kwargs) -> SkillResult:
        """执行指定的 skill"""
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

        return skill.execute(**kwargs)

    @classmethod
    def list_skills(cls) -> Dict[str, Dict[str, Any]]:
        """列出所有已注册的 skills"""
        return {
            name: cls.get_skill(name).get_info()
            for name in cls._skills.keys()
        }
```

---

## 四、调研 Skills 详细设计

### 4.1 调研计划生成 Skill

```python
# backend/app/skills/research/plan_generator.py

from typing import Dict, Any
from ..base import BaseSkill, SkillConfig, SkillResult
from ..registry import SkillRegistry

class ResearchPlanConfig(SkillConfig):
    """调研计划生成配置"""
    name: str = "research_plan_generator"
    description: str = "生成市场调研计划"
    model: str = "gemini-3-pro-preview"
    max_steps: int = 10

@SkillRegistry.register("research_plan_generator")
class ResearchPlanGenerator(BaseSkill):
    """调研计划生成器"""

    def __init__(self, config: dict = None):
        default_config = ResearchPlanConfig()
        if config:
            default_config = ResearchPlanConfig(**config)
        super().__init__(default_config)

    def _validate_config(self):
        """验证配置"""
        if self.config.max_steps < 1:
            raise ValueError("max_steps must be >= 1")

    def execute(self,
                query_text: str,
                history_context: str = "",
                metadata: Dict[str, Any] = None) -> SkillResult:
        """
        生成调研计划

        Args:
            query_text: 用户查询文本
            history_context: 历史上下文
            metadata: 数据元信息

        Returns:
            SkillResult 包含调研计划
        """
        try:
            # 调用 Gemini 生成计划
            plan = self._generate_plan(query_text, history_context, metadata)

            return SkillResult(
                success=True,
                data=plan,
                metadata={
                    "model": self.config.model,
                    "steps_count": len(plan.get("steps", []))
                }
            )
        except Exception as e:
            return SkillResult(
                success=False,
                error=str(e)
            )

    def _generate_plan(self, query_text: str,
                       history_context: str,
                       metadata: Dict[str, Any]) -> Dict[str, Any]:
        """内部方法：生成计划逻辑"""
        # 这里实现具体的计划生成逻辑
        # 从 gemini_engine.py 的 generate_market_research_plan 迁移
        pass
```

### 4.2 数据收集 Skill

```python
# backend/app/skills/research/data_collector.py

from typing import Dict, Any, List
import pandas as pd
from ..base import BaseSkill, SkillConfig, SkillResult
from ..registry import SkillRegistry

class DataCollectorConfig(SkillConfig):
    """数据收集配置"""
    name: str = "research_data_collector"
    description: str = "从数据库收集调研数据"
    timeout: int = 30  # 秒

@SkillRegistry.register("research_data_collector")
class ResearchDataCollector(BaseSkill):
    """调研数据收集器"""

    def __init__(self, config: dict = None):
        default_config = DataCollectorConfig()
        if config:
            default_config = DataCollectorConfig(**config)
        super().__init__(default_config)

    def _validate_config(self):
        """验证配置"""
        if self.config.timeout < 1:
            raise ValueError("timeout must be >= 1")

    def execute(self,
                step: Dict[str, Any],
                dfs_map: Dict[str, pd.DataFrame],
                accumulated_context: str = "") -> SkillResult:
        """
        执行数据收集步骤

        Args:
            step: 调研步骤定义
            dfs_map: 数据表字典
            accumulated_context: 累积的上下文

        Returns:
            SkillResult 包含收集的数据
        """
        try:
            # 执行数据查询
            result = self._collect_data(step, dfs_map, accumulated_context)

            return SkillResult(
                success=True,
                data=result,
                metadata={
                    "step_id": step.get("id"),
                    "phase": step.get("phase"),
                    "rows_collected": len(result.get("data", []))
                }
            )
        except Exception as e:
            return SkillResult(
                success=False,
                error=str(e),
                metadata={"step_id": step.get("id")}
            )

    def _collect_data(self, step: Dict[str, Any],
                      dfs_map: Dict[str, pd.DataFrame],
                      accumulated_context: str) -> Dict[str, Any]:
        """内部方法：数据收集逻辑"""
        # 从 gemini_engine.py 的 execute_research_step 迁移
        pass
```

---

## 五、使用示例

### 5.1 在 FastAPI 中使用

```python
# backend/app/main.py

from app.skills.registry import SkillRegistry
from app.skills.research import *  # 自动注册所有 research skills

@app.post("/api/research/plan")
async def create_research_plan(request: QueryRequest):
    """生成调研计划"""
    result = SkillRegistry.execute_skill(
        "research_plan_generator",
        query_text=request.text,
        history_context=request.history or "",
        metadata=get_metadata()
    )

    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)

    return result.data

@app.post("/api/research/collect")
async def collect_research_data(request: ExecuteResearchStepRequest):
    """收集调研数据"""
    result = SkillRegistry.execute_skill(
        "research_data_collector",
        step=request.step,
        dfs_map=get_dataframes(),
        accumulated_context=request.context or ""
    )

    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)

    return result.data
```

### 5.2 组合使用多个 Skills

```python
# 完整的调研流程
def execute_full_research(query: str):
    # 1. 生成计划
    plan_result = SkillRegistry.execute_skill(
        "research_plan_generator",
        query_text=query
    )

    if not plan_result.success:
        return {"error": plan_result.error}

    plan = plan_result.data
    results = []

    # 2. 执行每个步骤
    for step in plan["steps"]:
        if step["phase"] == "数据准备":
            result = SkillRegistry.execute_skill(
                "research_data_collector",
                step=step,
                dfs_map=get_dataframes()
            )
        elif step["phase"] == "数据分析":
            result = SkillRegistry.execute_skill(
                "research_data_analyzer",
                step=step,
                collected_data=results[-1].data
            )

        results.append(result)

    # 3. 生成报告
    report_result = SkillRegistry.execute_skill(
        "research_report_generator",
        plan=plan,
        results=results
    )

    return report_result.data
```

---

## 六、迁移计划

### 阶段一：基础架构搭建（第1周）
- [ ] 创建 skills 包目录结构
- [ ] 实现 BaseSkill 基类
- [ ] 实现 SkillRegistry 注册器
- [ ] 编写基础测试用例

### 阶段二：调研 Skills 迁移（第2-3周）
- [ ] 迁移 ResearchPlanGenerator
- [ ] 迁移 ResearchDataCollector
- [ ] 迁移 ResearchDataAnalyzer
- [ ] 迁移 ResearchReportGenerator
- [ ] 迁移 ResearchMetadataBuilder

### 阶段三：看板 Skills 迁移（第4周）
- [ ] 迁移 ChartRecommender
- [ ] 迁移 InsightGenerator
- [ ] 迁移 DataRefresher

### 阶段四：集成和测试（第5周）
- [ ] 更新 main.py API 端点
- [ ] 前端适配新的 API
- [ ] 完整的集成测试
- [ ] 性能测试和优化

### 阶段五：文档和部署（第6周）
- [ ] 编写 Skills 开发文档
- [ ] 编写使用示例
- [ ] 部署到生产环境
- [ ] 监控和反馈收集

---

## 七、优势分析

### 7.1 相比现有架构的优势

**现有架构问题：**
- 所有功能耦合在 gemini_engine.py（1600+ 行）
- 难以测试单个功能
- 添加新功能需要修改核心文件
- 代码复用困难

**Skills 架构优势：**
- ✅ **模块化**：每个 skill 独立，职责清晰
- ✅ **可测试**：单元测试更容易编写
- ✅ **可扩展**：添加新 skill 不影响现有代码
- ✅ **可复用**：skills 可以在不同场景复用
- ✅ **可配置**：每个 skill 有独立配置
- ✅ **易维护**：代码结构清晰，易于理解

### 7.2 性能影响

- **启动时间**：略微增加（需要注册 skills）
- **运行时性能**：基本无影响（使用单例模式）
- **内存占用**：略微增加（skill 实例缓存）

---

## 八、最佳实践

### 8.1 Skill 开发规范

1. **单一职责**：每个 skill 只做一件事
2. **配置驱动**：通过配置控制行为
3. **错误处理**：统一的错误处理机制
4. **日志记录**：记录关键操作
5. **文档完善**：每个 skill 有清晰的文档

### 8.2 命名规范

- Skill 类名：`XxxYyySkill` 或 `XxxYyyGenerator`
- Config 类名：`XxxYyyConfig`
- 注册名称：`xxx_yyy_zzz`（小写+下划线）

### 8.3 测试规范

每个 skill 至少包含：
- 单元测试（测试核心逻辑）
- 集成测试（测试与其他模块的交互）
- 性能测试（测试执行时间）

---

## 九、后续扩展方向

1. **Skill 市场**：支持第三方 skill 插件
2. **Skill 编排**：可视化编排多个 skills
3. **Skill 监控**：监控每个 skill 的执行情况
4. **Skill 版本管理**：支持多版本共存
5. **Skill 热更新**：不重启服务更新 skill

---

**文档版本：** 1.0
**创建日期：** 2026-02-01
**维护者：** PharmCube BI Team
