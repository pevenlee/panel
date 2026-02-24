"""
调研相关 skills
"""

# 自动导入并注册所有调研 skills
from .plan_generator import ResearchPlanGenerator
from .data_collector import ResearchDataCollector
from .report_generator import ResearchReportGenerator

__all__ = [
    "ResearchPlanGenerator",
    "ResearchDataCollector",
    "ResearchReportGenerator",
]
