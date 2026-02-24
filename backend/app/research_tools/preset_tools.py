"""
预置的调研工具
"""
from . import ResearchTool, ResearchToolRegistry


# ==================== 注册所有工具 ====================

def register_all_tools():
    """注册所有预置工具"""

    # 先尝试从配置文件加载
    config = ResearchToolRegistry.load_config()

    if config:
        # 如果配置文件存在，从配置文件加载工具
        print(f"[preset_tools] 从配置文件加载工具...")
        for tool_id, tool_data in config.items():
            try:
                tool = ResearchTool(**tool_data)
                ResearchToolRegistry.register(tool)
            except Exception as e:
                print(f"[preset_tools] 加载工具 {tool_id} 失败: {e}")
        print(f"[preset_tools] 已从配置文件加载 {len(config)} 个工具")
    else:
        # 如果配置文件不存在，使用硬编码的默认工具
        print(f"[preset_tools] 配置文件不存在，使用默认工具...")
        register_default_tools()
        # 保存默认工具到配置文件
        ResearchToolRegistry.save_config()
        print(f"[preset_tools] 工具注册完成，使用硬编码的默认工具")


def register_default_tools():
    """注册默认的硬编码工具"""
    default_tools_list = [
        # 数据获取
        ResearchTool(
            tool_id="cube_sales_data",
            tool_name="魔方销售数据",
            category="data_extraction",
            description="获取魔方系统的销售数据",
            config={"model": "fast", "database": "IPM"},
            data_source_type="database",
            databases=["fact", "ipmdata"],
            model="fast",
            time_range_enabled=True,
            default_time_range=365,
            output_types=["table", "chart"],
            system_prompt="你是一个专业的医药数据分析师。请准确理解产品名称、时间范围等关键信息，并从魔方数据库中提取相关数据。",
            preset_questions=[
                "查询阿托伐他汀2023年全年的销售数据",
                "对比辉瑞和阿斯利康在心血管领域的市场表现",
            ]
        ),
        ResearchTool(
            tool_id="retail_sales_data",
            tool_name="零售销售数据",
            category="data_extraction",
            description="获取零售渠道的销售数据",
            config={"model": "fast"},
            data_source_type="database",
            databases=["ipmdata"],
            model="fast",
            time_range_enabled=True,
            default_time_range=365,
            output_types=["table", "chart"],
        ),
        ResearchTool(
            tool_id="research_sales_data",
            tool_name="调研销售数据",
            category="data_extraction",
            description="获取市场调研的销售数据",
            config={"model": "fast"},
            data_source_type="database",
            databases=["fact", "ipmdata"],
            model="fast",
            time_range_enabled=True,
            default_time_range=365,
            output_types=["table", "chart"],
        ),
        # 图表制作
        ResearchTool(
            tool_id="recommended_chart",
            tool_name="推荐图表制作",
            category="chart_creation",
            description="AI自动推荐最适合的图表类型",
            config={"model": "image"},
            model="image",
            output_types=["chart"],
        ),
        ResearchTool(
            tool_id="custom_chart",
            tool_name="自定义图表制作",
            category="chart_creation",
            description="自定义图表样式和数据展示",
            config={"model": "image"},
            model="image",
            output_types=["chart"],
        ),
        # 产品调研
        ResearchTool(
            tool_id="financial_report",
            tool_name="财报信息",
            category="product_research",
            description="获取企业财务报告和经营数据",
            config={"model": "deep"},
            model="deep",
            output_types=["markdown", "table"],
        ),
        ResearchTool(
            tool_id="public_opinion",
            tool_name="舆情信息",
            category="product_research",
            description="分析产品和品牌舆情动态",
            config={"model": "deep"},
            model="deep",
            output_types=["markdown"],
        ),
        ResearchTool(
            tool_id="clinical_info",
            tool_name="临床信息",
            category="product_research",
            description="获取药品临床试验和研究信息",
            config={"model": "deep"},
            model="deep",
            output_types=["markdown", "table"],
        ),
        ResearchTool(
            tool_id="approval_info",
            tool_name="申报审批",
            category="product_research",
            description="查询药品申报和审批进度",
            config={"model": "deep"},
            model="deep",
            output_types=["markdown", "table"],
        ),
        ResearchTool(
            tool_id="drug_trading",
            tool_name="药品交易",
            category="product_research",
            description="获取药品交易和流通数据",
            config={"model": "deep"},
            model="deep",
            output_types=["markdown", "table"],
        ),
        # 报告制作
        ResearchTool(
            tool_id="sequential_assembly",
            tool_name="顺序拼接",
            category="report_creation",
            description="按顺序拼接多个内容生成报告",
            config={"model": "deep"},
            model="deep",
            output_types=["markdown"],
        ),
        ResearchTool(
            tool_id="content_summary",
            tool_name="内容总结",
            category="report_creation",
            description="智能总结和提炼核心内容",
            config={"model": "deep"},
            model="deep",
            output_types=["markdown"],
        ),
    ]

    for tool in default_tools_list:
        ResearchToolRegistry.register(tool)

    print(f"[preset_tools] 已注册 {len(default_tools_list)} 个默认工具")


def load_tools_from_excel():
    """注册所有预置工具"""
    import pandas as pd
    import os
    import json
    
    # Calculate path to xlsx
    # preset_tools.py is in backend/app/research_tools/
    # xlsx is in backend/data/
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    xlsx_path = os.path.join(base_dir, "data", "research_tool.xlsx")
    
    print(f"[preset_tools] Attempting to load tools from: {xlsx_path}")
    
    if not os.path.exists(xlsx_path):
        print(f"[preset_tools] Error: File not found at {xlsx_path}")
        return

    try:
        df = pd.read_excel(xlsx_path)
        print(f"[preset_tools] Loaded {len(df)} rows from Excel")
        
        # Column Matching
        # 任务类型 -> category
        # 工具 -> tool_name
        # 输入 -> input_schema (description)
        # 输出内容 -> output_schema (description)
        # 模型 -> config.model
        # 数据库 -> config.database
        
        category_map = {
            "数据获取": "data_extraction",
            "图表制作": "chart_creation",
            "产品调研": "product_research",
            "报告制作": "report_creation"
        }
        
        model_map = {
            "gemini-3-pro-preview": "deep",
            "gemini-3-pro-image-preview": "image",
            "default": "fast"
        }
        
        # Icon Mapping
        icon_map = {
            "data_extraction": "📊",
            "chart_creation": "📈",
            "product_research": "🔎",
            "report_creation": "📑"
        }

        tool_icons = {
            "魔方销售数据": "📊",
            "零售销售数据": "🏪",
            "调研销售数据": "📋",
            "推荐图表制作": "🤖",
            "自定义图表制作": "✏️",
            "财报信息": "💰",
            "舆情信息": "📣",
            "临床信息": "🏥",
            "申报审批": "📜",
            "药品交易": "💊",
            "顺序拼接": "🔗",
            "内容总结": "📝"
        }

        count = 0
        for _, row in df.iterrows():
            task_type = row.get("任务类型")
            tool_name = row.get("工具")
            
            if pd.isna(task_type) or pd.isna(tool_name):
                continue
                
            cat_key = category_map.get(task_type, "other")
            
            # Generate ID
            # e.g. "企业数据" -> "corporate_data" (needs manual map or simple hash/translit, 
            # but better to use a map if possible to keep compatibility with frontend logic if any. 
            # Actually, frontend likely uses ID. The Excel doesn't have ID. 
            # I will generate ID based on name hash or Pinyin if I had pinyin lib, 
            # effectively I should mapping standard names to IDs if they match known ones, else random.
            # For this task, I will hardcode a map for known tools to preserve existing logic if possible, 
            # or just use simple ID generation.)
            
            # Simple ID mapping based on name
            id_map = {
                "魔方销售数据": "cube_sales_data",
                "零售销售数据": "retail_sales_data",
                "调研销售数据": "research_sales_data",
                "推荐图表制作": "recommended_chart",
                "自定义图表制作": "custom_chart",
                "财报信息": "financial_report",
                "舆情信息": "public_opinion",
                "临床信息": "clinical_info",
                "申报审批": "approval_info",
                "药品交易": "drug_trading",
                "顺序拼接": "sequential_assembly",
                "内容总结": "content_summary"
            }
            
            tool_id = id_map.get(tool_name, f"tool_{hash(tool_name) % 10000}")
            
            # Schema
            input_desc = row.get("输入") if not pd.isna(row.get("输入")) else "No input specified"
            output_desc = row.get("输出内容") if not pd.isna(row.get("输出内容")) else "No output specified"
            
            # Config
            model_raw = row.get("模型")
            database_raw = row.get("数据库")
            
            model_id = model_map.get(model_raw, "fast")
            if pd.isna(model_raw): model_id = "fast"
            
            tool_config = {
                "model": model_id
            }
            if not pd.isna(database_raw):
                tool_config["database"] = database_raw
                
            # Icon
            icon = tool_icons.get(tool_name, icon_map.get(cat_key, "🔧"))

            tool = ResearchTool(
                tool_id=tool_id,
                tool_name=tool_name,
                category=cat_key,
                description=f"Input: {input_desc}. Output: {output_desc}", # Composite description
                icon=icon,
                input_schema={"description": input_desc}, # Simple schema for now
                output_schema={"description": output_desc},
                config=tool_config
            )
            
            ResearchToolRegistry.register(tool)
            count += 1
            
        print(f"[preset_tools] dynamic registration complete. {count} tools registered.")

    except Exception as e:
        print(f"[preset_tools] Error reading Excel: {e}")
        # Fallback to empty or limited set if critical? 
        # For now, print error.


# 自动注册
register_all_tools()

