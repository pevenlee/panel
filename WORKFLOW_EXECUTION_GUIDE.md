# 工作流节点执行功能说明

## 功能概述

实现了可视化工作流编排系统，支持：
1. **单节点独立执行** - 每个节点可以单独运行
2. **节点间数据传递** - 通过连线传递上游节点的输出到下游节点
3. **实时执行监控** - 右侧执行看板实时显示每一步的执行状态

---

## 前端实现

### 1. WorkflowCanvas.jsx 修改

#### 新增功能：
- 每个节点卡片上添加了 **绿色播放按钮** (PlayCircleOutlined)
- 点击播放按钮可以单独执行该节点
- 执行时按钮显示加载动画 (LoadingOutlined)

#### 关键代码：
```jsx
// 单独执行当前节点
const handleExecuteNode = async () => {
    if (!data.onExecute) return;

    setIsExecuting(true);
    try {
        await data.onExecute(id);
    } catch (error) {
        message.error('节点执行失败: ' + error.message);
    } finally {
        setIsExecuting(false);
    }
};
```

#### 数据传递逻辑：
```jsx
// 执行单个节点
const handleExecuteNode = useCallback(async (nodeId) => {
    // 获取当前节点
    const currentNode = nodes.find(n => n.id === nodeId);

    // 查找输入节点（通过连线）
    const inputEdges = edges.filter(e => e.target === nodeId);
    const inputNodeIds = inputEdges.map(e => e.source);

    // 获取输入数据
    const inputData = inputNodeIds.map(inputId => {
        const inputNode = nodes.find(n => n.id === inputId);
        return inputNode?.data?.executionResult || null;
    }).filter(Boolean);

    // 调用父组件的执行函数
    await onNodeExecute(nodeId, currentNode.data, inputData);
}, [nodes, edges, onNodeExecute]);
```

---

### 2. ResearchPlanEditor.jsx 修改

#### 新增功能：
- 实现 `handleNodeExecute` 函数处理单节点执行
- 自动展开右侧执行看板显示执行状态
- 支持接收上游节点的输出数据

#### 关键代码：
```jsx
// 执行单个节点
const handleNodeExecute = async (nodeId, nodeData, inputData) => {
    setOutputPanelCollapsed(false);

    // 查找对应的步骤
    const step = steps.find(s => s.id?.toString() === nodeId);

    // 初始化执行状态
    setExecution(prev => {
        // ... 更新执行状态
    });

    try {
        // 调用后端执行单个步骤
        const response = await fetch('http://localhost:8000/api/research/execute-workflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                steps: [{
                    ...step,
                    inputData: inputData // 传递上游节点的输出
                }]
            })
        });

        // 处理执行结果
        // ...
    } catch (error) {
        // 错误处理
    }
};
```

---

### 3. ExecutionPanel.jsx 修改

#### 新增功能：
- 优化空状态提示，引导用户点击节点执行按钮
- 显示执行提示图标

#### 关键代码：
```jsx
if (!execution) {
    return (
        <div style={{ color: '#999', textAlign: 'center', marginTop: '40px' }}>
            <ClockCircleOutlined style={{ fontSize: '24px' }} />
            暂无执行任务
            <div style={{ marginTop: '8px' }}>
                点击节点上的 <PlayCircleOutlined style={{ color: '#52c41a' }} /> 按钮执行单个节点
            </div>
        </div>
    );
}
```

---

## 后端实现

### main.py 修改

#### 新增功能：
- 支持接收 `inputData` 参数（上游节点的输出）
- 优先使用 `inputData`，如果没有则使用 `previous_output`

#### 关键代码：
```python
for index, step in enumerate(steps):
    step_id = step.get("id")
    tool_id = step.get("tool_id")
    action = step.get("action", "")
    rationale = step.get("rationale", "")
    data_sources = step.get("dataSources", [])
    input_data = step.get("inputData", [])  # 上游节点的输出数据

    if input_data:
        print(f"[workflow] 接收到 {len(input_data)} 个上游节点的输入数据")

    # 执行魔方销售数据查询
    # 优先使用 input_data，如果没有则使用 previous_output
    input_for_query = input_data[0] if input_data else previous_output

    query_result = await execute_cube_sales_internal(
        node_id=str(step_id),
        data_tables=data_tables,
        query_text=rationale,
        previous_data=input_for_query
    )
```

---

## 使用方法

### 1. 单节点执行
1. 在画布上拖拽或添加节点
2. 点击节点进行配置（步骤名称、数据源、数据范围）
3. 点击节点右上角的 **绿色播放按钮** ▶️
4. 右侧执行看板自动展开，显示执行进度和结果

### 2. 连线数据传递
1. 创建多个节点
2. 从节点底部的连接点拖拽到另一个节点顶部，建立连线
3. 执行下游节点时，会自动接收上游节点的输出数据
4. 后端会将上游数据作为 `inputData` 传递给执行函数

### 3. 完整工作流执行
1. 配置好所有节点和连线
2. 点击底部的 **"执行工作流"** 按钮
3. 系统会按照连线顺序依次执行所有节点
4. 每个节点的输出会自动传递给下一个节点

---

## 执行状态说明

### 节点状态
- **pending** (待执行) - 灰色时钟图标
- **running** (执行中) - 蓝色加载动画
- **completed** (已完成) - 绿色对勾图标
- **error** (执行失败) - 红色错误标签

### 执行看板显示
- **总体进度** - 显示总步骤数和当前进度
- **步骤详情** - 每个步骤的执行状态
- **数据表格** - 如果有查询结果，显示数据表格
- **错误信息** - 如果执行失败，显示错误详情

---

## 数据流示意图

```
节点A (数据准备)
    ↓ 输出: 销售数据表
    ↓ (连线传递)
节点B (数据分析)
    ↓ 接收: 节点A的输出
    ↓ 输出: 分析结果
    ↓ (连线传递)
节点C (报告生成)
    ↓ 接收: 节点B的输出
    ↓ 输出: 最终报告
```

---

## 技术特性

1. **异步执行** - 使用 async/await 处理异步操作
2. **状态管理** - 使用 React State 管理执行状态
3. **实时反馈** - 执行过程中实时更新 UI
4. **错误处理** - 完善的错误捕获和提示
5. **数据持久化** - 节点执行结果保存在节点数据中

---

## 注意事项

1. **连线顺序** - 确保连线方向正确（从上游到下游）
2. **数据格式** - 上游节点的输出格式需要与下游节点的输入格式匹配
3. **执行依赖** - 如果节点有连线输入，建议先执行上游节点
4. **并发执行** - 目前不支持并发执行多个节点，建议按顺序执行

---

## 后续优化建议

1. **可视化连线数据** - 在连线上显示传递的数据摘要
2. **节点执行历史** - 保存每次执行的历史记录
3. **条件分支** - 支持根据执行结果选择不同的执行路径
4. **并行执行** - 支持无依赖关系的节点并行执行
5. **数据预览** - 在节点上直接预览执行结果
