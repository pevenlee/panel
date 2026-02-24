"""
调研计划生成 Skill
从用户查询生成完整的市场调研计划
"""

import os
from typing import Dict, Any, Optional
from ..base import BaseSkill, SkillConfig, SkillResult
from ..registry import SkillRegistry

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


class ResearchPlanConfig(SkillConfig):
    """调研计划生成配置"""
    name: str = "research_plan_generator"
    description: str = "生成市场调研计划"
    model: str = "gemini-3-pro-preview"
    max_steps: int = 10


@SkillRegistry.register("research_plan_generator")
class ResearchPlanGenerator(BaseSkill):
    """调研计划生成器 - 为市场调研生成多阶段执行计划"""

    def __init__(self, config: dict = None):
        default_config = ResearchPlanConfig()
        if config:
            default_config = ResearchPlanConfig(**{**default_config.dict(), **config})
        super().__init__(default_config)
        self._client = None

    def _validate_config(self):
        """验证配置"""
        if self.config.max_steps < 1:
            raise ValueError("max_steps must be >= 1")

    def _get_client(self):
        """获取 Gemini 客户端"""
        if self._client is not None:
            return self._client

        api_key = os.environ.get("GENAI_API_KEY", "").strip()
        if not api_key:
            return None

        try:
            if genai is None:
                return None
            self._client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
            return self._client
        except Exception:
            return None

    def execute(self,
                query_text: str,
                research_metadata: str,
                history_context: str = "") -> SkillResult:
        """
        生成调研计划

        Args:
            query_text: 用户查询文本
            research_metadata: 研究元数据（表结构说明）
            history_context: 历史上下文

        Returns:
            SkillResult 包含调研计划
        """
        client = self._get_client()
        if not client:
            return SkillResult(
                success=False,
                error="未配置 GENAI_API_KEY"
            )

        try:
            plan_data = self._generate_plan(
                client,
                query_text,
                research_metadata,
                history_context
            )

            return SkillResult(
                success=True,
                data=plan_data,
                metadata={
                    "model": self.config.model,
                    "steps_count": len(plan_data.get("plan", []))
                }
            )
        except Exception as e:
            return SkillResult(
                success=False,
                error=f"市场调研规划失败: {str(e)}"
            )

    def _generate_plan(self,
                       client,
                       query_text: str,
                       research_metadata: str,
                       history_context: str) -> Dict[str, Any]:
        """内部方法：生成计划逻辑"""

        research_prompt = f"""
你是一位资深医药市场分析专家，拥有丰富的行业经验和数据分析能力。
用户正在进行市场调研，问题是："{query_text}"

【可用数据源详细说明】
{research_metadata}

【历史上下文】
{history_context}

【调研方案设计要求】
你的任务是设计一个【完整的调研方案】，必须包含以下5个阶段：

**阶段一：数据准备**
- 从 df_fact 和 df_ipm 表中提取相关数据
- 明确需要查询哪些企业/产品/ATC分类等
- 说明如何关联两表（通过'药品索引'字段）

**阶段二：数据分析设计**
- 设计数据分析的维度（时间、渠道、地区等）
- 设计需要计算的指标（销售额、增长率、市场份额等）
- 说明数据聚合和计算逻辑

**阶段三：信息源梳理**
- 梳理可能存在调研结果的网页类型（如新闻网站、专业报告、企业官网、行业论坛等）
- 说明每种网页类型可能提供的信息

**阶段四：信息采集**
- 基于所有相关网页类型，整理需要采集的具体信息
- 说明如何组织和结构化采集到的信息

**阶段五：综合分析**
- 将网页信息与内部销售数据关联
- 形成完整的分析报告
"""

        return self._call_gemini_for_plan(client, research_prompt, query_text)

    def _call_gemini_for_plan(self, client, prompt: str, query_text: str) -> Dict[str, Any]:
        """调用 Gemini API 生成计划"""
        # 添加 JSON 输出格式说明
        json_format = """
【输出要求】
- 返回 JSON 格式
- 在描述中使用专业但易懂的语言，避免过于技术化
- 每个步骤必须明确属于哪个阶段
- 对于数据准备阶段，要基于上述元数据中的实际字段设计查询

{
  "research_strategy": "整体调研策略的简要描述（2-3句话）",
  "plan": [
    {
      "id": 1,
      "phase": "数据准备",
      "source": "database",
      "action": "从 df_ipm 表筛选出相关企业/产品，并关联 df_fact 表获取销售数据",
      "rationale": "为后续分析提供数据基础",
      "expected_output": "包含销售额、销售量的时间序列数据"
    }
  ]
}
"""
        full_prompt = prompt + json_format

        # 调用 Gemini API
        response = client.models.generate_content(
            model=self.config.model,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        # 解析响应
        import json
        json_res = json.loads(response.text)

        research_strategy = json_res.get("research_strategy", "根据询问设计如下调研操作")
        plan_items = json_res.get("plan", [])

        return {
            "mode": "plan_confirmation",
            "plan": plan_items,
            "title": "调研方案",
            "logicDescription": research_strategy,
            "config": {}
        }
