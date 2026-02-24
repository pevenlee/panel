# Skills 使用指南

## 快速开始

### 1. 导入 Skills

```python
# 在 main.py 中导入
from app.skills.registry import SkillRegistry
from app.skills.research import *  # 自动注册所有 research skills
```

### 2. 使用调研计划生成 Skill

```python
from app import gemini_engine

@app.post("/api/research/plan")
async def create_research_plan(request: QueryRequest):
    """生成调研计划"""

    # 获取数据和元数据
    df, dfs_map, time_context, meta_data = gemini_engine.get_cached_data()
    research_metadata = gemini_engine.build_research_metadata(dfs_map)

    # 调用 skill
    result = SkillRegistry.execute_skill(
        "research_plan_generator",
        query_text=request.text,
        research_metadata=research_metadata,
        history_context=request.history or ""
    )

    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)

    return result.data
```

### 3. 使用数据收集 Skill

```python
@app.post("/api/research/collect")
async def collect_research_data(request: ExecuteResearchStepRequest):
    """收集调研数据"""

    # 获取数据
    df, dfs_map, time_context, meta_data = gemini_engine.get_cached_data()
    research_metadata = gemini_engine.build_research_metadata(dfs_map)

    # 调用 skill
    result = SkillRegistry.execute_skill(
        "research_data_collector",
        step=request.step,
        dfs_map=dfs_map,
        research_metadata=research_metadata,
        accumulated_context=request.context or ""
    )

    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)

    return result.data
```

### 4. 使用报告生成 Skill

```python
@app.post("/api/research/report")
async def generate_research_report(request: GenerateReportRequest):
    """生成调研报告"""

    # 调用 skill
    result = SkillRegistry.execute_skill(
        "research_report_generator",
        query_text=request.query_text,
        plan=request.plan,
        step_results=request.step_results
    )

    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)

    return result.data
```

## 完整示例

### 完整的调研流程

```python
async def execute_full_research(query: str):
    """完整的调研流程示例"""
    from app import gemini_engine

    # 步骤 1: 生成计划
    df, dfs_map, _, _ = gemini_engine.get_cached_data()
    research_metadata = gemini_engine.build_research_metadata(dfs_map)

    plan_result = SkillRegistry.execute_skill(
        "research_plan_generator",
        query_text=query,
        research_metadata=research_metadata,
        history_context=""
    )

    if not plan_result.success:
        return {"error": plan_result.error}

    plan = plan_result.data
    step_results = []

    # 步骤 2: 执行每个步骤
    for step in plan["plan"]:
        if step["phase"] in ["数据准备", "数据分析设计"]:
            result = SkillRegistry.execute_skill(
                "research_data_collector",
                step=step,
                dfs_map=dfs_map,
                research_metadata=research_metadata,
                accumulated_context=""
            )
            step_results.append(result.data)

    # 步骤 3: 生成报告
    report_result = SkillRegistry.execute_skill(
        "research_report_generator",
        query_text=query,
        plan=plan,
        step_results=step_results
    )

    return report_result.data
```

## 查看已注册的 Skills

```python
# 列出所有已注册的 skills
skills = SkillRegistry.list_skills()
print(skills)
```

## 注意事项

1. **Skills 自动注册**: 导入时会自动注册所有 skills
2. **单例模式**: 每个 skill 只创建一次实例
3. **错误处理**: 执行失败时返回 SkillResult(success=False, error=...)
4. **元数据**: 执行结果包含 metadata 字段
