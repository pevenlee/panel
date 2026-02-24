# 市场调研模块使用示例

## 快速开始

### 1. 启动服务

确保后端和前端服务已启动：

```bash
# 后端
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 前端
cd frontend
npm run dev
```

### 2. 使用市场调研功能

在前端选择"市场调研"模块，输入查询问题，例如：

```
分析某某药企在心血管领域的市场表现和竞争态势
```

### 3. 系统处理流程

#### 阶段1：生成调研方案
系统会自动生成一个包含5个阶段的调研方案：
- 数据准备
- 数据分析设计
- 信息源梳理
- 信息采集
- 综合分析

#### 阶段2：执行调研步骤
逐步执行每个阶段，使用增强的元数据系统确保：
- ✅ 正确识别表字段
- ✅ 准确关联 fact 和 ipm 表
- ✅ 生成可执行的查询代码

## 查询示例

### 示例1：企业市场分析

**问题**：分析辉瑞在全国的销售趋势

**系统处理**：
1. 从 IPM 表筛选企业：`df_ipm[df_ipm['生产企业'].str.contains('辉瑞', na=False)]`
2. 获取药品索引列表
3. 从 Fact 表关联销售数据
4. 按时间聚合展示趋势

### 示例2：ATC分类分析

**问题**：消化系统用药的市场规模有多大？

**系统处理**：
1. 从 IPM 表筛选 ATC 分类：`df_ipm[df_ipm['ATC1Des'].str.contains('消化', na=False)]`
2. 获取该分类下的所有药品索引
3. 从 Fact 表统计总销售额
4. 按年季展示趋势

### 示例3：集采影响分析

**问题**：分析第一批集采药品的销售变化

**系统处理**：
1. 从 IPM 表筛选：`df_ipm[df_ipm['集采批次'] == '第一批']`
2. 获取中选和未中选药品列表
3. 分别统计销售数据
4. 对比分析集采前后变化

## 高级用法

### 自定义查询逻辑

如果需要更精细的控制，可以在数据准备阶段指定具体的查询条件：

**示例**：仅分析零售渠道的数据

```python
# 系统会生成类似的代码
企业药品 = df_ipm[df_ipm['生产企业'].str.contains('某企业', na=False)]['药品索引'].unique()
df_sub = df_fact[
    (df_fact['药品索引'].isin(企业药品)) &
    (df_fact['渠道'] == '零售')  # 仅零售渠道
].copy()
result = df_sub.groupby('年季')['销售额'].sum().reset_index()
results = {'零售渠道销售': result}
```

### 多维度分析

**示例**：按渠道分别展示销售

```python
企业药品 = df_ipm[df_ipm['生产企业'].str.contains('某企业', na=False)]['药品索引'].unique()
df_sub = df_fact[df_fact['药品索引'].isin(企业药品)].copy()
result = df_sub.groupby(['年季', '渠道'])['销售额'].sum().reset_index()
# 透视表展示
result_pivot = result.pivot(index='年季', columns='渠道', values='销售额').reset_index()
results = {'分渠道销售': result_pivot}
```

## 常见问题

### Q1: 为什么查询结果为空？

**可能原因**：
1. 企业名称拼写不完全匹配
2. 筛选条件过于严格

**解决方法**：
- 使用模糊匹配：`.str.contains('关键词', na=False)`
- 先查看 IPM 表中的企业名称列表
- 放宽筛选条件

### Q2: 数值计算结果不正确？

**检查清单**：
- ✅ 销售额和销售量已自动转换为数值类型（改进后）
- ✅ 确认使用了正确的聚合函数（sum, mean 等）
- ✅ 检查是否正确 reset_index()

### Q3: 如何查看可用的字段？

**方法1**：查看元数据预览
```bash
cd backend
python test_research_metadata.py
cat data/research_metadata_preview.txt
```

**方法2**：查看分析结果
```bash
cat data/metadata_analysis.json
```

## 性能优化建议

### 大数据量查询

如果查询涉及大量数据：

1. **先筛选后关联**：
```python
# 好的做法
ipm_filtered = df_ipm[df_ipm['企业类型'] == '内资']
fact_filtered = df_fact[df_fact['药品索引'].isin(ipm_filtered['药品索引'])]

# 避免的做法（先关联再筛选）
merged = pd.merge(df_fact, df_ipm, on='药品索引')
filtered = merged[merged['企业类型'] == '内资']  # 太慢
```

2. **使用合适的聚合级别**：
```python
# 如果只需要季度数据，不要按天聚合
result = df.groupby('年季')['销售额'].sum()  # 好
# result = df.groupby('日期')['销售额'].sum()  # 数据量大时很慢
```

### 缓存常用查询

对于重复的企业或产品查询，可以缓存药品索引列表：

```python
# 缓存辉瑞的药品列表
pfizer_drugs = df_ipm[df_ipm['生产企业'].str.contains('辉瑞', na=False)]['药品索引'].unique()
# 后续查询直接使用
df_sub = df_fact[df_fact['药品索引'].isin(pfizer_drugs)]
```

## 调试技巧

### 查看生成的代码

在开发模式下，可以查看系统生成的实际查询代码：
- 检查后端日志输出
- 查看 API 返回的 code 字段

### 分步验证

如果查询失败，可以分步验证：

```python
# Step 1: 验证 IPM 筛选
企业药品 = df_ipm[df_ipm['生产企业'].str.contains('某企业', na=False)]
print(f"找到 {len(企业药品)} 个药品")

# Step 2: 验证关联
药品索引列表 = 企业药品['药品索引'].unique()
print(f"药品索引: {药品索引列表[:10]}")

# Step 3: 验证 Fact 筛选
df_sub = df_fact[df_fact['药品索引'].isin(药品索引列表)]
print(f"销售记录: {len(df_sub)} 条")

# Step 4: 验证聚合
result = df_sub.groupby('年季')['销售额'].sum()
print(result)
```

## 最佳实践

1. **问题描述要具体**：
   - ✅ "分析辉瑞在心血管领域 2023-2024 年的销售趋势"
   - ❌ "看看销售情况"

2. **逐步分析**：
   - 先看整体趋势
   - 再做细分分析（按产品、按地区等）

3. **结合定性和定量**：
   - 数据准备阶段：获取定量数据
   - 信息采集阶段：获取定性洞察
   - 综合分析阶段：结合两者

4. **验证数据合理性**：
   - 检查销售额的数量级是否合理
   - 验证时间序列是否连续
   - 对比历史趋势判断异常值

## 更新日志

### v2.0 (2024-02-01) - 增强的元数据系统
- ✅ 新增详细的表结构说明
- ✅ 提供 4 种查询模式示例
- ✅ 数据预处理优化
- ✅ 增强 Prompt 设计

### v1.0 (2024-01-XX) - 初始版本
- 基础的市场调研功能
- 简单的规则引擎
