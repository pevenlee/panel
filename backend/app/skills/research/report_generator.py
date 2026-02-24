"""
调研报告生成 Skill
将调研结果生成 HTML 格式的报告
"""

import os
from typing import Dict, Any, List
from ..base import BaseSkill, SkillConfig, SkillResult
from ..registry import SkillRegistry

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


class ReportGeneratorConfig(SkillConfig):
    """报告生成配置"""
    name: str = "research_report_generator"
    description: str = "生成市场调研报告"
    model: str = "gemini-3-pro-preview"


@SkillRegistry.register("research_report_generator")
class ResearchReportGenerator(BaseSkill):
    """调研报告生成器 - 生成 HTML 格式的调研报告"""

    def __init__(self, config: dict = None):
        default_config = ReportGeneratorConfig()
        if config:
            default_config = ReportGeneratorConfig(**{**default_config.dict(), **config})
        super().__init__(default_config)
        self._client = None

    def _validate_config(self):
        """验证配置"""
        pass

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
                plan: Dict[str, Any],
                step_results: List[Dict[str, Any]]) -> SkillResult:
        """
        生成调研报告

        Args:
            query_text: 用户查询文本
            plan: 调研计划
            step_results: 各步骤的执行结果

        Returns:
            SkillResult 包含 HTML 报告
        """
        client = self._get_client()
        if not client:
            return SkillResult(
                success=False,
                error="未配置 GENAI_API_KEY"
            )

        try:
            html_report = self._generate_report(
                client,
                query_text,
                plan,
                step_results
            )

            return SkillResult(
                success=True,
                data={"html": html_report},
                metadata={"model": self.config.model}
            )
        except Exception as e:
            return SkillResult(
                success=False,
                error=f"报告生成失败: {str(e)}"
            )

    def _generate_report(self,
                         client,
                         query_text: str,
                         plan: Dict[str, Any],
                         step_results: List[Dict[str, Any]]) -> str:
        """内部方法：生成报告逻辑"""

        # 整理步骤结果
        context = self._format_step_results(step_results)

        report_prompt = f"""
你是一位资深医药市场分析专家。请根据调研结果生成一份专业的市场调研报告。

【调研问题】
{query_text}

【调研结果】
{context}

【报告要求】
1. 使用 HTML 格式输出
2. 包含标题、摘要、详细分析、结论等部分
3. 数据用表格展示
4. 使用专业但易懂的语言
5. 突出关键发现和洞察

请生成完整的 HTML 报告。
"""

        response = client.models.generate_content(
            model=self.config.model,
            contents=report_prompt
        )

        return self._extract_html(response.text)

    def _format_step_results(self, step_results: List[Dict[str, Any]]) -> str:
        """格式化步骤结果为文本"""
        formatted = []
        for result in step_results:
            step_id = result.get("step_id", "")
            phase = result.get("phase", "")
            content = result.get("content", "")
            formatted.append(f"## 步骤 {step_id}: {phase}\n{content}\n")
        return "\n".join(formatted)

    def _extract_html(self, text: str) -> str:
        """从响应中提取 HTML"""
        import re
        # 提取 ```html ... ``` 代码块
        match = re.search(r'```html\s*(.*?)\s*```', text, re.DOTALL)
        if match:
            return match.group(1).strip()
        # 提取 ``` ... ``` 代码块
        match = re.search(r'```\s*(.*?)\s*```', text, re.DOTALL)
        if match:
            return match.group(1).strip()
        # 没有代码块标记，返回全部文本
        return text.strip()
