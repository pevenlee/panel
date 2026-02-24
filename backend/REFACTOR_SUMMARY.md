# 市场调研模块重构总结

## 重构完成情况

### ✅ 已完成的工作

#### 1. 数据获取环节重构（三步骤拆分）

在 `gemini_engine.py` 中新增了三个函数：

**步骤 1.1: `identify_entities()`**
- 功能：从用户问题中识别关键实体（企业、产品、ATC分类等）
- 输入：用户问题文本
- 输出：结构化的实体信息 + 分析意图 + 置信度

**步骤 1.2: `construct_query()`**
- 功能：基于识别的实体构建精确的 Pandas 查询代码
- 输入：实体信息 + 分析意图
- 输出：待执行的代码 + 查询说明 + 验证检查项

**步骤 1.3: `execute_query()`**
- 功能：执行查询代码并返回结构化数据
- 输入：查询代码 + 验证检查项
- 输出：数据结果 + 执行状态 + 性能指标

#### 2. 分析设计环节重构（企业分析专项模板）

**新增函数: `generate_enterprise_analysis_framework()`**
- 功能：生成企业分析的标准化框架
- 包含 5 个分析模块：
  1. ATC1分类分布（饼图）
  2. 核心产品分析（表格）- 前10%销售额产品
  3. 增长指标（KPI）- 同比增长率
  4. 市场地位（KPI）- 行业份额占比
  5. 渠道分布（柱状图）

#### 3. 重构 `execute_research_step()` 函数

- **数据准备阶段**：改为调用三步骤流程
- **数据分析设计阶段**：自动识别企业分析并生成结构化框架

---

## 重构效果

### 数据获取环节的改进

**之前**：
- 单一步骤直接生成并执行代码
- 实体识别不准确时整个查询失败
- 难以调试和定位问题

**现在**：
- ✅ 三步骤清晰可见，每步可独立验证
- ✅ 实体识别失败时可及时发现并调整
- ✅ 查询构建和执行分离，便于调试
- ✅ 返回详细的执行信息（行数、列名、执行时间）

### 分析设计环节的改进

**之前**：
- 纯文本输出，后续步骤难以利用
- 缺乏针对性的分析模板
- 分析维度不够系统

**现在**：
- ✅ 企业分析标准化、系统化
- ✅ 输出结构化 JSON，便于前端展示和后续使用
- ✅ 自动生成 5 个维度的完整分析框架
- ✅ 用户可预览并确认分析方案

---

## 使用示例

### 示例 1：企业分析流程

**用户问题**："分析辉瑞在消化道领域的市场表现"

**步骤 1.1 - 识别实体**：
```json
{
  "entities": {
    "企业": ["辉瑞"],
    "ATC分类": ["XA-消化道和代谢方面的药物"]
  },
  "query_intent": "企业分析",
  "confidence": 0.95
}
```

**步骤 1.2 - 构建查询**：
```python
# 查询辉瑞在消化道领域的药品
消化道ATC = df_ipm[df_ipm['ATC1Des'] == 'XA-消化道和代谢方面的药物']['药品索引'].unique()
辉瑞药品 = df_ipm[df_ipm['生产企业'].str.contains('辉瑞', na=False)]['药品索引'].unique()
目标药品 = list(set(消化道ATC) & set(辉瑞药品))
df_sub = df_fact[df_fact['药品索引'].isin(目标药品)].copy()
results = {'辉瑞消化道产品': df_sub}
```

**步骤 1.3 - 执行查询**：
```json
{
  "success": true,
  "rows": 192,
  "columns": ["药品索引", "渠道", "年季", "销售额", "销售量"],
  "execution_time_ms": 45.2
}
```

**步骤 2 - 生成分析框架**：
```
企业分析框架（5个模块）：
1. ATC1分类分布（饼图）
2. 核心产品分析（表格）
3. 增长指标（KPI）
4. 市场地位（KPI）
5. 渠道分布（柱状图）
```

---

## 测试方法

已创建测试脚本 `test_refactor.py`，可以测试各个功能：

```bash
cd backend
python test_refactor.py
```

测试内容包括：
1. 实体识别功能
2. 查询构建功能
3. 查询执行功能
4. 企业分析框架生成

---

## 下一步工作

### 前端适配（需要前端开发）

1. **支持三步骤展示**
   - 显示实体识别结果
   - 显示查询代码（可编辑）
   - 显示执行结果

2. **支持结构化分析框架展示**
   - 以卡片形式展示 5 个分析模块
   - 用户可选择执行哪些模块
   - 显示每个模块的预期输出

3. **用户确认机制**
   - 在执行查询前让用户确认识别的实体
   - 在生成分析前让用户确认分析框架

### API 接口更新（已完成）

`/api/execute-research-step` 接口已支持新的返回格式：
- `output_type: "data_table_with_steps"` - 包含三步骤详情
- `output_type: "structured_analysis_framework"` - 包含结构化框架

---

## 技术细节

### 新增的返回格式

**数据准备阶段返回**：
```json
{
  "step_id": 1,
  "phase": "数据准备",
  "output_type": "data_table_with_steps",
  "data": [...],
  "steps": {
    "step1_entities": {
      "name": "识别实体",
      "entities": {...},
      "query_intent": "企业分析"
    },
    "step2_query": {
      "name": "构建查询",
      "code": "...",
      "explanation": "..."
    },
    "step3_execution": {
      "name": "执行查询",
      "rows": 100,
      "execution_time_ms": 45
    }
  }
}
```

**分析设计阶段返回**：
```json
{
  "step_id": 2,
  "phase": "数据分析设计",
  "output_type": "structured_analysis_framework",
  "content": "Markdown格式的框架说明",
  "framework": {
    "analysis_type": "企业分析",
    "target_entity": "辉瑞",
    "analysis_modules": [...]
  }
}
```

---

## 文件清单

### 修改的文件
- `backend/app/gemini_engine.py` - 核心重构

### 新增的文件
- `backend/REFACTOR_SUMMARY.md` - 本文档
- `backend/RESEARCH_REFACTOR_PROPOSAL.md` - 重构方案
- `backend/test_refactor.py` - 测试脚本

---

## 注意事项

1. **API Key 配置**：确保 `backend/.env` 中配置了 `GENAI_API_KEY`
2. **数据文件**：确保 `backend/data/` 目录下有 `fact.csv` 和 `ipmdata.xlsx`
3. **依赖库**：确保安装了 `google-genai` 库

---

## 联系与反馈

如有问题或建议，请在项目中提出 Issue。
