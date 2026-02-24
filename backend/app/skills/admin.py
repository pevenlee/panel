"""
Skills 管理 API
提供 Skills 的可视化管理接口
"""

import os
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path

# 配置文件路径
SKILLS_CONFIG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "data",
    "skills_config.json"
)

SKILLS_METRICS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "data",
    "skills_metrics.json"
)


class SkillsConfigManager:
    """Skills 配置管理器"""

    @staticmethod
    def load_config() -> Dict[str, Any]:
        """加载配置文件"""
        if not os.path.exists(SKILLS_CONFIG_FILE):
            return {}
        try:
            with open(SKILLS_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    @staticmethod
    def save_config(config: Dict[str, Any]):
        """保存配置文件"""
        os.makedirs(os.path.dirname(SKILLS_CONFIG_FILE), exist_ok=True)
        with open(SKILLS_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)

    @staticmethod
    def get_skill_config(skill_name: str) -> Optional[Dict[str, Any]]:
        """获取单个 Skill 的配置"""
        config = SkillsConfigManager.load_config()
        return config.get(skill_name)

    @staticmethod
    def update_skill_config(skill_name: str, new_config: Dict[str, Any]):
        """更新单个 Skill 的配置"""
        config = SkillsConfigManager.load_config()
        if skill_name not in config:
            config[skill_name] = {}
        config[skill_name].update(new_config)
        SkillsConfigManager.save_config(config)


class SkillsMetricsManager:
    """Skills 执行指标管理器"""

    @staticmethod
    def load_metrics() -> Dict[str, List[Dict[str, Any]]]:
        """加载执行指标"""
        if not os.path.exists(SKILLS_METRICS_FILE):
            return {}
        try:
            with open(SKILLS_METRICS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    @staticmethod
    def save_metrics(metrics: Dict[str, List[Dict[str, Any]]]):
        """保存执行指标"""
        os.makedirs(os.path.dirname(SKILLS_METRICS_FILE), exist_ok=True)
        with open(SKILLS_METRICS_FILE, "w", encoding="utf-8") as f:
            json.dump(metrics, f, ensure_ascii=False, indent=2)

    @staticmethod
    def record_execution(skill_name: str, success: bool, duration_ms: float, error: str = None):
        """记录 Skill 执行"""
        metrics = SkillsMetricsManager.load_metrics()
        if skill_name not in metrics:
            metrics[skill_name] = []

        record = {
            "timestamp": datetime.now().isoformat(),
            "success": success,
            "duration_ms": duration_ms,
            "error": error
        }

        metrics[skill_name].append(record)

        # 只保留最近 100 条记录
        if len(metrics[skill_name]) > 100:
            metrics[skill_name] = metrics[skill_name][-100:]

        SkillsMetricsManager.save_metrics(metrics)

    @staticmethod
    def get_skill_stats(skill_name: str) -> Dict[str, Any]:
        """获取 Skill 的统计信息"""
        metrics = SkillsMetricsManager.load_metrics()
        records = metrics.get(skill_name, [])

        if not records:
            return {
                "total_executions": 0,
                "success_count": 0,
                "failure_count": 0,
                "success_rate": 0,
                "avg_duration_ms": 0,
                "recent_executions": []
            }

        total = len(records)
        success_count = sum(1 for r in records if r["success"])
        failure_count = total - success_count
        success_rate = (success_count / total * 100) if total > 0 else 0
        avg_duration = sum(r["duration_ms"] for r in records) / total if total > 0 else 0

        return {
            "total_executions": total,
            "success_count": success_count,
            "failure_count": failure_count,
            "success_rate": round(success_rate, 2),
            "avg_duration_ms": round(avg_duration, 2),
            "recent_executions": records[-10:]  # 最近 10 条
        }
