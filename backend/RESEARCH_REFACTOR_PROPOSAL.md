# 市场调研模块重构方案

## 一、数据获取环节重构（三步骤拆分）

### 当前问题
- 单一步骤直接生成并执行代码，缺乏中间验证
- 实体识别不准确时，整个查询失败
- 难以调试和优化

### 重构方案：拆分为3个子步骤

#### 步骤1.1：识别实体（Entity Recognition）
**输入**：用户问题 + 元数据
**输出**：结构化的实体信息
```json
{
  "entities": {
    "企业": ["辉瑞", "阿斯利康"],
    "产品": ["立普妥"],
    "ATC分类": ["XA-消化道和代谢方面的药物"],
    "时间范围": ["21Q1", "21Q4"],
    "渠道": ["零售"]
  },
  "query_intent": "企业销售分析",
  "confidence": 0.95
}
```

#### 步骤1.2：构建查询（Query Construction）
**输入**：识别的实体 + 元数据
**输出**：待执行的 Pandas 代码 + 查询说明
```json
{
  "code": "# 查询辉瑞的销售数据\n企业药品 = df_ipm[df_ipm['生产企业'].str.contains('辉瑞', na=False)]['药品索引'].unique()\ndf_sub = df_fact[df_fact['药品索引'].isin(企业药品)].copy()\nresult = df_sub.groupby('年季')['销售额'].sum().reset_index()\nresults = {'辉瑞销售趋势': result}",
  "explanation": "从IPM表筛选辉瑞的药品，关联Fact表获取销售数据，按时间汇总",
  "expected_columns": ["年季", "销售额"],
  "validation_checks": [
    "企业药品数量 > 0",
    "销售数据行数 > 0"
  ]
}
```

#### 步骤1.3：执行查询（Query Execution）
**输入**：查询代码
**输出**：数据结果 + 执行状态
```json
{
  "success": true,
  "data": [...],
  "rows": 16,
  "columns": ["年季", "销售额"],
  "validation_passed": true,
  "execution_time_ms": 45
}
```

---

## 二、分析设计环节重构（企业分析专项模板）

### 当前问题
- 纯文本输出，后续步骤难以利用
- 缺乏针对性的分析模板
- 分析维度不够系统

### 重构方案：企业分析标准化框架

当识别到用户问题是"企业分析"时，自动生成以下结构化分析框架：

```json
{
  "analysis_type": "企业分析",
  "target_entity": "辉瑞",
  "analysis_modules": [
    {
      "module_id": "atc_distribution",
      "module_name": "ATC1分类分布",
      "chart_type": "pie",
      "description": "该企业不同ATC1分类的销售额占比",
      "data_requirements": {
        "dimensions": ["ATC1Des"],
        "metrics": ["销售额"],
        "filters": ["企业='辉瑞'", "时间=最近4个季度"]
      },
      "expected_output": "饼图：各ATC1分类占比"
    },
    {
      "module_id": "top_products",
      "module_name": "核心产品分析",
      "chart_type": "table",
      "description": "前10%销售额的产品及其市场份额",
      "data_requirements": {
        "dimensions": ["药品名称", "通用名"],
        "metrics": ["销售额", "市场份额", "企业内占比"],
        "filters": ["企业='辉瑞'", "排名=Top 10%"],
        "calculations": [
          "市场份额 = 该产品销售额 / 该通用名全市场销售额",
          "企业内占比 = 该产品销售额 / 企业总销售额"
        ]
      },
      "expected_output": "表格：产品名称 | 销售额 | 市场份额 | 企业内占比"
    },
    {
      "module_id": "growth_metrics",
      "module_name": "增长指标",
      "chart_type": "kpi",
      "description": "企业整体同比增长率",
      "data_requirements": {
        "metrics": ["当期销售额", "同期销售额", "同比增长率"],
        "time_comparison": "MAT vs Prior MAT",
        "calculations": [
          "同比增长率 = (当期销售额 - 同期销售额) / 同期销售额 * 100%"
        ]
      },
      "expected_output": "KPI卡片：+15.3% 同比增长"
    },
    {
      "module_id": "market_share",
      "module_name": "市场地位",
      "chart_type": "kpi",
      "description": "企业占行业整体份额",
      "data_requirements": {
        "metrics": ["企业销售额", "行业总销售额", "市场份额"],
        "calculations": [
          "市场份额 = 企业销售额 / 行业总销售额 * 100%"
        ]
      },
      "expected_output": "KPI卡片：8.5% 市场份额 | 行业排名第3"
    },
    {
      "module_id": "channel_distribution",
      "module_name": "渠道分布",
      "chart_type": "bar",
      "description": "不同渠道的销售额分布",
      "data_requirements": {
        "dimensions": ["渠道"],
        "metrics": ["销售额", "占比"],
        "filters": ["企业='辉瑞'", "时间=最近4个季度"]
      },
      "expected_output": "柱状图：各渠道销售额"
    }
  ],
  "execution_order": [
    "atc_distribution",
    "top_products",
    "growth_metrics",
    "market_share",
    "channel_distribution"
  ]
}
```

---

## 三、实施计划

### 阶段1：重构数据获取环节
1. 新增 `identify_entities()` 函数
2. 新增 `construct_query()` 函数
3. 重构 `execute_research_step()` 中的"数据准备"部分

### 阶段2：重构分析设计环节
1. 新增 `generate_enterprise_analysis_framework()` 函数
2. 新增企业分析模板配置
3. 重构 `execute_research_step()` 中的"数据分析设计"部分

### 阶段3：前端适配
1. 支持多步骤展示（识别实体 → 构建查询 → 执行查询）
2. 支持结构化分析框架的可视化展示
3. 支持用户确认和调整

---

## 四、预期效果

### 数据获取环节
- ✅ 实体识别准确率提升
- ✅ 查询失败时可定位到具体步骤
- ✅ 用户可在执行前确认识别结果

### 分析设计环节
- ✅ 企业分析标准化、系统化
- ✅ 输出结构化，便于后续步骤使用
- ✅ 用户可预览完整分析框架并确认

---

## 五、示例流程

### 用户问题："分析辉瑞在消化道领域的市场表现"

#### 步骤1.1：识别实体
```
✓ 企业：辉瑞
✓ ATC分类：XA-消化道和代谢方面的药物
✓ 分析类型：企业分析
```

#### 步骤1.2：构建查询
```python
# 查询辉瑞在消化道领域的药品
消化道ATC = df_ipm[df_ipm['ATC1Des'] == 'XA-消化道和代谢方面的药物']['药品索引'].unique()
辉瑞药品 = df_ipm[df_ipm['生产企业'].str.contains('辉瑞', na=False)]['药品索引'].unique()
目标药品 = list(set(消化道ATC) & set(辉瑞药品))
df_sub = df_fact[df_fact['药品索引'].isin(目标药品)].copy()
```

#### 步骤1.3：执行查询
```
✓ 找到 12 个相关药品
✓ 获取 192 条销售记录
```

#### 步骤2：生成分析框架
```
企业分析框架（5个模块）：
1. ATC1分类分布（饼图）
2. 核心产品分析（表格）
3. 增长指标（KPI）
4. 市场地位（KPI）
5. 渠道分布（柱状图）

是否确认执行？
```
