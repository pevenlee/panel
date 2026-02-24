"""
调研数据收集 Skill
执行数据库查询，收集调研所需的数据
"""

import os
import pandas as pd
from typing import Dict, Any, List
from ..base import BaseSkill, SkillConfig, SkillResult
from ..registry import SkillRegistry

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


class DataCollectorConfig(SkillConfig):
    """数据收集配置"""
    name: str = "research_data_collector"
    description: str = "从数据库收集调研数据"
    timeout: int = 30  # 秒
    model: str = "gemini-3-flash-preview"


@SkillRegistry.register("research_data_collector")
class ResearchDataCollector(BaseSkill):
    """调研数据收集器 - 执行数据查询步骤"""

    def __init__(self, config: dict = None):
        default_config = DataCollectorConfig()
        if config:
            default_config = DataCollectorConfig(**{**default_config.dict(), **config})
        super().__init__(default_config)
        self._client = None

    def _validate_config(self):
        """验证配置"""
        if self.config.timeout < 1:
            raise ValueError("timeout must be >= 1")

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
                step: Dict[str, Any],
                dfs_map: Dict[str, pd.DataFrame],
                research_metadata: str,
                accumulated_context: str = "") -> SkillResult:
        """
        执行数据收集步骤

        Args:
            step: 调研步骤定义
            dfs_map: 数据表字典 (fact, ipm)
            research_metadata: 研究元数据
            accumulated_context: 累积的上下文

        Returns:
            SkillResult 包含收集的数据
        """
        client = self._get_client()
        if not client:
            return SkillResult(
                success=False,
                error="未配置 GENAI_API_KEY"
            )

        try:
            result = self._collect_data(
                client,
                step,
                dfs_map,
                research_metadata,
                accumulated_context
            )

            return SkillResult(
                success=True,
                data=result,
                metadata={
                    "step_id": step.get("id"),
                    "phase": step.get("phase")
                }
            )
        except Exception as e:
            return SkillResult(
                success=False,
                error=str(e),
                metadata={"step_id": step.get("id")}
            )

    def _collect_data(self,
                      client,
                      step: Dict[str, Any],
                      dfs_map: Dict[str, pd.DataFrame],
                      research_metadata: str,
                      accumulated_context: str) -> Dict[str, Any]:
        """内部方法：数据收集逻辑"""

        phase = step.get("phase", "")
        action = step.get("action", "")
        expected_output = step.get("expected_output", "")

        # 检查可用表
        available_tables = []
        if 'fact' in dfs_map:
            available_tables.append("df_fact")
        if 'ipm' in dfs_map:
            available_tables.append("df_ipm")

        if not available_tables:
            raise ValueError("市场调研数据表（fact/ipm）未加载")

        # 根据阶段类型构建不同的 Prompt
        if phase == "数据准备":
            return self._execute_data_preparation(
                client, step, dfs_map, research_metadata, accumulated_context
            )
        elif phase == "数据分析设计":
            return self._execute_analysis_design(
                client, step, accumulated_context
            )
        else:
            # 其他阶段返回文本输出
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "text",
                "content": f"执行步骤：{action}"
            }

    def _execute_data_preparation(self,
                                   client,
                                   step: Dict[str, Any],
                                   dfs_map: Dict[str, pd.DataFrame],
                                   research_metadata: str,
                                   accumulated_context: str) -> Dict[str, Any]:
        """执行数据准备阶段"""
        action = step.get("action", "")
        expected_output = step.get("expected_output", "")

        step_prompt = f"""
你是一位医药行业数据分析专家。请根据任务要求生成精确的 Pandas 代码来查询数据。

【任务描述】
- 任务: {action}
- 预期产出: {expected_output}

【数据表详细结构和使用指南】
{research_metadata}

【已有上下文】
{accumulated_context}

【代码生成要求】
1. 必须严格遵守上述元数据中的字段名称，不要臆造字段
2. 数值字段已预处理为 float64，可直接使用
3. 表关联使用 '药品索引' 字段
4. 模糊匹配使用 .str.contains('关键词', na=False)
5. 最终 DataFrame 必须 reset_index()
6. 变量命名使用有意义的中文变量名，最终结果存入 results 字典

请生成 Python 代码，只返回代码，不要有其他说明。
"""
        return self._execute_code_generation(client, step_prompt, step, dfs_map)

    def _execute_analysis_design(self,
                                  client,
                                  step: Dict[str, Any],
                                  accumulated_context: str) -> Dict[str, Any]:
        """执行数据分析设计阶段"""
        action = step.get("action", "")
        expected_output = step.get("expected_output", "")

        design_prompt = f"""
你是一位医药行业数据分析专家。请根据任务要求设计详细的分析框架。

【任务描述】
- 任务: {action}
- 预期产出: {expected_output}

【已有上下文】
{accumulated_context}

请设计详细的分析框架，包括：
1. 分析维度（时间、渠道、产品等）
2. 关键指标（销售额、增长率、市场份额等）
3. 分析方法和步骤

以 Markdown 格式输出。
"""
        response = client.models.generate_content(
            model=self.config.model,
            contents=design_prompt
        )

        return {
            "step_id": step.get("id"),
            "phase": "数据分析设计",
            "output_type": "text",
            "content": response.text
        }

    def _execute_code_generation(self,
                                  client,
                                  prompt: str,
                                  step: Dict[str, Any],
                                  dfs_map: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
        """生成并执行代码"""
        # 调用 Gemini 生成代码
        response = client.models.generate_content(
            model=self.config.model,
            contents=prompt
        )

        code = self._extract_code(response.text)

        # 执行代码
        results = self._execute_code(code, dfs_map)

        return {
            "step_id": step.get("id"),
            "phase": step.get("phase"),
            "output_type": "data",
            "content": results,
            "code": code
        }

    def _extract_code(self, text: str) -> str:
        """从响应中提取代码"""
        import re
        # 提取 ```python ... ``` 代码块
        match = re.search(r'```python\s*(.*?)\s*```', text, re.DOTALL)
        if match:
            return match.group(1).strip()
        # 提取 ``` ... ``` 代码块
        match = re.search(r'```\s*(.*?)\s*```', text, re.DOTALL)
        if match:
            return match.group(1).strip()
        # 没有代码块标记，返回全部文本
        return text.strip()

    def _execute_code(self, code: str, dfs_map: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
        """执行生成的代码"""
        # 准备执行环境
        local_vars = {
            'pd': pd,
            'df_fact': dfs_map.get('fact'),
            'df_ipm': dfs_map.get('ipm'),
            'results': {}
        }

        try:
            exec(code, {"__builtins__": __builtins__}, local_vars)
            results = local_vars.get('results', {})

            # 转换 DataFrame 为字典
            output = {}
            for key, value in results.items():
                if isinstance(value, pd.DataFrame):
                    output[key] = value.to_dict('records')
                else:
                    output[key] = value

            return output
        except Exception as e:
            raise ValueError(f"代码执行失败: {str(e)}\n代码:\n{code}")
