import React, { useState, useEffect } from 'react';
import { Button, message, Input } from 'antd';
import { RightOutlined, LeftOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import WorkflowCanvas from './WorkflowCanvas';
import FloatingToolbox from './FloatingToolbox';
import ExecutionPanel from './ExecutionPanel';
import ToolboxManagement from './ToolboxManagement';
import ToolDetailPanel from './ToolDetailPanel';
import { API_BASE_URL } from '../services/api';

// 拓扑排序函数：根据节点依赖关系确定执行顺序
const topologicalSort = (nodes, edges) => {
  // 构建邻接表和入度表
  const adjacencyList = {};
  const inDegree = {};
  const nodeMap = {};

  // 初始化
  nodes.forEach(node => {
    adjacencyList[node.id] = [];
    inDegree[node.id] = 0;
    nodeMap[node.id] = node;
  });

  // 构建图
  edges.forEach(edge => {
    adjacencyList[edge.source].push(edge.target);
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
  });

  // 找出所有入度为0的节点（可以并行执行的起始节点）
  const queue = [];
  const executionLevels = []; // 按层级组织的执行顺序

  Object.keys(inDegree).forEach(nodeId => {
    if (inDegree[nodeId] === 0) {
      queue.push(nodeId);
    }
  });

  // 按层级进行拓扑排序
  while (queue.length > 0) {
    const currentLevel = [...queue];
    executionLevels.push(currentLevel.map(id => nodeMap[id]));
    queue.length = 0;

    currentLevel.forEach(nodeId => {
      adjacencyList[nodeId].forEach(neighborId => {
        inDegree[neighborId]--;
        if (inDegree[neighborId] === 0) {
          queue.push(neighborId);
        }
      });
    });
  }

  return executionLevels;
};

const ResearchPlanEditor = ({ initialPlan, onConfirm, onCancel, isStandalone = false }) => {
  const [steps, setSteps] = useState([]);
  const [tools, setTools] = useState([]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(isStandalone);
  const [showToolboxManagement, setShowToolboxManagement] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [canvasList, setCanvasList] = useState([
    { id: 1, name: '画布 1', active: true, steps: [], nodes: [], edges: [] }
  ]);
  const [currentCanvasId, setCurrentCanvasId] = useState(1);
  const [editingCanvasId, setEditingCanvasId] = useState(null);
  const [editingCanvasName, setEditingCanvasName] = useState('');
  const [execution, setExecution] = useState(null);
  const [outputPanelCollapsed, setOutputPanelCollapsed] = useState(true);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [showNodeDetailPanel, setShowNodeDetailPanel] = useState(false);
  const [selectedNodeForEdit, setSelectedNodeForEdit] = useState(null);
  const [hasManuallyCleared, setHasManuallyCleared] = useState(false);

  useEffect(() => {
    // 如果用户手动清空了画布，不要重新加载 initialPlan
    if (hasManuallyCleared) {
      return;
    }
    if (initialPlan && initialPlan.plan) {
      setSteps(initialPlan.plan);
    }
  }, [initialPlan, hasManuallyCleared]);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/research/tools`);
      const data = await response.json();
      setTools(data.tools || []);
    } catch (error) {
      message.error('获取工具列表失败');
    }
  };

  const handleToolSelect = (tool) => {
    console.log('[handleToolSelect] 添加工具:', tool);
    console.log('[handleToolSelect] userConfig:', tool.userConfig);
    console.log('[handleToolSelect] hasManuallyCleared:', hasManuallyCleared);

    // 用户开始添加工具，重置清空标志位
    if (hasManuallyCleared) {
      console.log('[handleToolSelect] 重置 hasManuallyCleared 标志位');
      setHasManuallyCleared(false);
    }

    const newStep = {
      id: Date.now(),
      action: tool.tool_name || `使用${tool.tool_name}`,
      tool_id: tool.tool_id,
      rationale: tool.userConfig?.custom_prompt || '',
      custom_prompt: tool.userConfig?.custom_prompt || '',
      dataSources: tool.userConfig?.databases || ['hospital_sales'],
      preset_question: tool.userConfig?.preset_question || '',
      system_prompt: tool.system_prompt || '',
      time_range: tool.userConfig?.time_range || 365,
      model: 'deep',
      input_schema: tool.input_schema,
      output_schema: tool.output_schema
    };

    console.log('[handleToolSelect] 新步骤:', newStep);

    // 使用函数式更新确保获取最新的 steps 状态
    setSteps(prevSteps => {
      console.log('[handleToolSelect] 当前步骤数量:', prevSteps.length);
      console.log('[handleToolSelect] 当前步骤列表:', prevSteps.map(s => ({ id: s.id, action: s.action })));
      const updatedSteps = [...prevSteps, newStep];
      console.log('[handleToolSelect] 更新后步骤数量:', updatedSteps.length);
      return updatedSteps;
    });

    message.success(`已添加步骤：${tool.tool_name}`);
  };

  const handleConfirm = () => {
    if (steps.length === 0) {
      message.warning('请至少添加一个步骤');
      return;
    }
    onConfirm(steps);
  };

  const handleCanvasRename = (id, newName) => {
    setCanvasList(canvasList.map(canvas =>
      canvas.id === id ? { ...canvas, name: newName } : canvas
    ));
    setEditingCanvasId(null);
    message.success('画布已重命名');
  };

  // 新建画布
  const handleCreateCanvas = () => {
    // 先保存当前画布的数据
    saveCurrentCanvasData();

    // 创建新画布
    const newId = Math.max(...canvasList.map(c => c.id), 0) + 1;
    const newCanvas = {
      id: newId,
      name: `画布 ${newId}`,
      active: true,
      steps: [],
      nodes: [],
      edges: []
    };

    // 更新画布列表，将所有画布设为非激活，新画布设为激活
    setCanvasList([...canvasList.map(c => ({ ...c, active: false })), newCanvas]);
    setCurrentCanvasId(newId);

    // 清空当前编辑区域
    setSteps([]);
    setNodes([]);
    setEdges([]);

    message.success('新建画布成功');
  };

  // 切换画布
  const handleSwitchCanvas = (canvasId) => {
    if (canvasId === currentCanvasId) {
      return; // 已经是当前画布，不做任何操作
    }

    // 保存当前画布的数据
    saveCurrentCanvasData();

    // 切换到目标画布
    const targetCanvas = canvasList.find(c => c.id === canvasId);
    if (targetCanvas) {
      setCanvasList(canvasList.map(c => ({
        ...c,
        active: c.id === canvasId
      })));
      setCurrentCanvasId(canvasId);

      // 加载目标画布的数据
      setSteps(targetCanvas.steps || []);
      setNodes(targetCanvas.nodes || []);
      setEdges(targetCanvas.edges || []);

      message.success(`已切换到 ${targetCanvas.name}`);
    }
  };

  // 保存当前画布数据
  const saveCurrentCanvasData = () => {
    setCanvasList(canvasList.map(canvas =>
      canvas.id === currentCanvasId
        ? { ...canvas, steps, nodes, edges }
        : canvas
    ));
  };

  // 接收图结构变化
  const handleGraphChange = (updatedNodes, updatedEdges) => {
    setNodes(updatedNodes);
    setEdges(updatedEdges);
  };

  // 执行单个节点
  const handleNodeExecute = async (nodeId, nodeData, inputData) => {
    setOutputPanelCollapsed(false);

    // 查找对应的步骤
    const step = steps.find(s => s.id?.toString() === nodeId);
    if (!step) {
      message.error('未找到对应的步骤');
      return;
    }

    // 打印输入数据日志
    console.log(`[节点执行] 节点ID: ${nodeId}, 节点名称: ${nodeData.label || step.action}`);
    console.log(`[节点输入] 接收到的输入数据:`, inputData);

    // 初始化或更新执行状态
    setExecution(prev => {
      const existingSteps = prev?.steps || [];
      const stepIndex = existingSteps.findIndex(s => s.id?.toString() === nodeId);

      let updatedSteps;
      if (stepIndex >= 0) {
        // 更新现有步骤状态
        updatedSteps = existingSteps.map((s, idx) =>
          idx === stepIndex ? {
            ...s,
            status: 'running',
            error: null,
            inputData: inputData // 保存输入数据
          } : s
        );
      } else {
        // 添加新步骤
        updatedSteps = [...existingSteps, {
          id: nodeId,
          name: nodeData.label || step.action,
          status: 'running',
          output: null,
          error: null,
          data: null,
          columns: null,
          description: null,
          inputData: inputData // 保存输入数据
        }];
      }

      return {
        totalSteps: updatedSteps.length,
        currentStep: updatedSteps.filter(s => s.status === 'completed').length + 1,
        steps: updatedSteps,
        status: 'running'
      };
    });

    try {
      // 调用后端执行单个步骤
      const response = await fetch(`${API_BASE_URL}/research/execute-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: [{
            ...step,
            inputData: inputData // 传递上游节点的输出
          }]
        })
      });

      const data = await response.json();

      if (data.success && data.results && data.results.length > 0) {
        const result = data.results[0];

        // 打印输出数据日志
        console.log(`[节点输出] 节点ID: ${nodeId} 执行完成`);
        console.log(`[节点输出] 产出数据:`, {
          output: result.output,
          data: result.data,
          columns: result.columns,
          description: result.description,
          row_count: result.row_count
        });

        // 更新执行结果
        setExecution(prev => {
          const updatedSteps = prev.steps.map(s => {
            if (s.id?.toString() === nodeId) {
              return {
                ...s,
                status: result.status || 'completed',
                output: result.output || result.description || '执行完成',
                error: result.error || null,
                data: result.data || null,
                columns: result.columns || null,
                description: result.description || null,
                table_preview: result.table_preview || null,
                row_count: result.row_count || null,
                chart_config: result.chart_config || null,
                chart_type: result.chart_type || null,
                markdown_content: result.markdown_content || null
              };
            }
            return s;
          });

          return {
            ...prev,
            steps: updatedSteps,
            currentStep: updatedSteps.filter(s => s.status === 'completed').length,
            status: updatedSteps.every(s => s.status === 'completed') ? 'completed' : 'running'
          };
        });

        // 将执行结果同步到节点数据中，供下游节点使用
        setNodes(prevNodes => prevNodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                executionResult: result.data // 存储执行结果
              }
            };
          }
          return node;
        }));

        // 同步执行结果到 steps 中，供 WorkflowCanvas 使用
        setSteps(prevSteps => prevSteps.map(step => {
          if (step.id?.toString() === nodeId) {
            return {
              ...step,
              data: result.data, // 存储执行结果数据
              status: 'completed'
            };
          }
          return step;
        }));

        message.success('节点执行完成');
      } else {
        throw new Error(data.error || '执行失败');
      }
    } catch (error) {
      console.error('节点执行错误:', error);

      // 更新错误状态
      setExecution(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.id?.toString() === nodeId
            ? { ...s, status: 'error', error: error.message }
            : s
        ),
        status: 'error'
      }));

      message.error('节点执行失败: ' + error.message);
    }
  };

  // 中止工作流
  const handleAbortWorkflow = () => {
    if (abortController) {
      abortController.abort();
      setIsExecuting(false);
      setAbortController(null);
      message.warning('工作流已中止');
    }
  };

  // 清空画布
  const handleClearCanvas = () => {
    console.log('[handleClearCanvas] 清空画布');

    // 设置标志位，防止 initialPlan 重新加载数据
    setHasManuallyCleared(true);

    // 先清空 nodes 和 edges，确保画布立即清空
    setNodes([]);
    setEdges([]);

    // 然后清空 steps，触发 WorkflowCanvas 的同步
    setSteps([]);

    setExecution(null);
    // 关闭可能打开的详情面板
    setShowNodeDetailPanel(false);
    setSelectedNodeForEdit(null);

    // 使用 setTimeout 确保状态完全清空后再显示成功消息
    setTimeout(() => {
      message.success('画布已清空');
    }, 100);
  };

  // 处理节点点击 - 打开详情面板
  const handleNodeClick = (nodeId) => {
    const step = steps.find(s => s.id?.toString() === nodeId);
    if (step) {
      console.log('[handleNodeClick] 找到步骤:', step);

      // 将 step 转换为 tool 格式，并包含已保存的配置
      const toolForEdit = {
        id: step.id,
        tool_id: step.tool_id,
        tool_name: step.action,
        // 传递已保存的配置数据
        userConfig: {
          databases: step.dataSources || [],
          custom_prompt: step.custom_prompt || step.rationale || '',
          preset_question: step.preset_question || '',
          time_range: step.time_range || 365
        },
        // 保存原始的 step 数据，用于后续更新
        _originalStep: step
      };

      console.log('[handleNodeClick] 传递给详情面板的数据:', toolForEdit);
      setSelectedNodeForEdit(toolForEdit);
      setShowNodeDetailPanel(true);
    }
  };

  // 处理节点详情面板确认
  const handleNodeDetailConfirm = (updatedTool) => {
    console.log('[handleNodeDetailConfirm] 接收到的更新数据:', updatedTool);
    console.log('[handleNodeDetailConfirm] userConfig:', updatedTool.userConfig);
    console.log('[handleNodeDetailConfirm] databases:', updatedTool.userConfig.databases);
    console.log('[handleNodeDetailConfirm] custom_prompt:', updatedTool.userConfig.custom_prompt);

    // 更新步骤配置
    setSteps(steps.map(s => {
      if (s.id === updatedTool.id) {
        const updatedStep = {
          ...s,
          // 明确映射字段
          dataSources: updatedTool.userConfig.databases || s.dataSources || [],
          custom_prompt: updatedTool.userConfig.custom_prompt || '',
          rationale: updatedTool.userConfig.custom_prompt || s.rationale || '',
          preset_question: updatedTool.userConfig.preset_question || '',
          time_range: updatedTool.userConfig.time_range || 365,
          // 保持原有的 action 和 tool_id
          action: updatedTool.tool_name || s.action,
          tool_id: updatedTool.tool_id || s.tool_id
        };
        console.log('[handleNodeDetailConfirm] 更新后的步骤:', updatedStep);
        console.log('[handleNodeDetailConfirm] dataSources:', updatedStep.dataSources);
        console.log('[handleNodeDetailConfirm] custom_prompt:', updatedStep.custom_prompt);
        return updatedStep;
      }
      return s;
    }));
    setShowNodeDetailPanel(false);
    setSelectedNodeForEdit(null);
    message.success('节点配置已更新');
  };

  // 处理节点详情面板关闭
  const handleNodeDetailClose = () => {
    setShowNodeDetailPanel(false);
    setSelectedNodeForEdit(null);
  };

  const handleExecuteWorkflow = async () => {
    if (steps.length === 0) {
      message.warning('请至少添加一个步骤');
      return;
    }

    setOutputPanelCollapsed(false);
    setIsExecuting(true);

    // 创建 AbortController 用于中止工作流
    const controller = new AbortController();
    setAbortController(controller);

    console.log(`[工作流执行] 开始执行完整工作流，共 ${steps.length} 个步骤`);
    console.log(`[工作流执行] 当前节点数: ${nodes.length}, 连线数: ${edges.length}`);

    // 执行拓扑排序
    const executionLevels = topologicalSort(nodes, edges);
    console.log(`[工作流执行] 拓扑排序完成，共 ${executionLevels.length} 个执行层级`);
    executionLevels.forEach((level, idx) => {
      console.log(`[工作流执行] 层级 ${idx + 1}: ${level.map(n => n.data.label).join(', ')}`);
    });

    // 初始化执行状态
    const executionSteps = steps.map((step) => ({
      id: step.id,
      name: step.action,
      status: 'pending',
      output: null,
      error: null,
      data: null,
      columns: null,
      description: null,
      level: -1
    }));

    // 标记每个步骤的执行层级
    executionLevels.forEach((level, levelIdx) => {
      level.forEach(node => {
        const stepIdx = executionSteps.findIndex(s => s.id?.toString() === node.id);
        if (stepIdx >= 0) {
          executionSteps[stepIdx].level = levelIdx;
        }
      });
    });

    setExecution({
      totalSteps: steps.length,
      currentStep: 0,
      steps: executionSteps,
      status: 'running',
      executionLevels: executionLevels.length
    });

    // 按层级执行工作流
    try {
      const nodeResults = {}; // 存储每个节点的执行结果

      for (let levelIdx = 0; levelIdx < executionLevels.length; levelIdx++) {
        // 检查是否已中止
        if (controller.signal.aborted) {
          console.log('[工作流执行] 工作流已被中止');
          throw new Error('工作流已被用户中止');
        }

        const currentLevel = executionLevels[levelIdx];
        console.log(`\n[工作流执行] ========== 执行层级 ${levelIdx + 1}/${executionLevels.length} ==========`);
        console.log(`[工作流执行] 本层级包含 ${currentLevel.length} 个节点，可并行执行`);

        // 并行执行当前层级的所有节点
        const levelPromises = currentLevel.map(async (node) => {
          const nodeId = node.id;
          const step = steps.find(s => s.id?.toString() === nodeId);

          if (!step) {
            console.warn(`[工作流执行] 未找到节点 ${nodeId} 对应的步骤`);
            return null;
          }

          console.log(`[工作流执行] 开始执行节点: ${node.data.label} (ID: ${nodeId})`);

          // 更新状态为执行中
          setExecution(prev => ({
            ...prev,
            steps: prev.steps.map(s =>
              s.id?.toString() === nodeId ? { ...s, status: 'running' } : s
            )
          }));

          // 获取输入数据（来自上游节点）
          const inputEdges = edges.filter(e => e.target === nodeId);
          const inputData = inputEdges.map(e => nodeResults[e.source]).filter(Boolean);

          if (inputData.length > 0) {
            console.log(`[工作流执行] 节点 ${node.data.label} 接收到 ${inputData.length} 个输入`);
          }

          try {
            const response = await fetch(`${API_BASE_URL}/research/execute-workflow`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                steps: [{
                  ...step,
                  inputData: inputData
                }]
              })
            });

            const data = await response.json();

            console.log(`[工作流执行] 后端返回的原始响应:`, data);

            if (data.success && data.results && data.results.length > 0) {
              const result = data.results[0];
              console.log(`[工作流执行] 完整的 result 对象:`, JSON.stringify(result, null, 2));
              console.log(`[工作流执行] 节点 ${node.data.label} 执行完成:`, {
                status: result.status,
                output: result.output,
                row_count: result.row_count
              });
              console.log(`[工作流执行] result.data 类型:`, typeof result.data);
              console.log(`[工作流执行] result.data 是否为数组:`, Array.isArray(result.data));
              console.log(`[工作流执行] result.data 长度:`, result.data?.length);
              console.log(`[工作流执行] result.chart_config:`, result.chart_config);

              // 保存节点结果
              nodeResults[nodeId] = result.data;

              // 更新执行状态
              setExecution(prev => ({
                ...prev,
                steps: prev.steps.map(s =>
                  s.id?.toString() === nodeId
                    ? {
                        ...s,
                        status: 'completed',
                        output: result.output || result.description || '执行完成',
                        data: result.data,
                        columns: result.columns,
                        description: result.description,
                        table_preview: result.table_preview,
                        row_count: result.row_count,
                        chart_config: result.chart_config,
                        chart_type: result.chart_type,
                        markdown_content: result.markdown_content
                      }
                    : s
                ),
                currentStep: prev.currentStep + 1
              }));

              return result;
            } else {
              throw new Error(data.error || '执行失败');
            }
          } catch (error) {
            console.error(`[工作流执行] 节点 ${node.data.label} 执行失败:`, error);

            setExecution(prev => ({
              ...prev,
              steps: prev.steps.map(s =>
                s.id?.toString() === nodeId
                  ? { ...s, status: 'error', error: error.message }
                  : s
              )
            }));

            throw error;
          }
        });

        // 等待当前层级所有节点执行完成
        await Promise.all(levelPromises);
        console.log(`[工作流执行] 层级 ${levelIdx + 1} 执行完成\n`);
      }

      // 所有层级执行完成
      console.log(`[工作流执行] ========== 工作流执行完成 ==========`);
      setExecution(prev => ({
        ...prev,
        status: 'completed',
        currentStep: steps.length
      }));

      message.success('工作流执行完成');
    } catch (error) {
      console.error('[工作流执行] 执行错误:', error);
      setExecution(prev => ({
        ...prev,
        status: 'error'
      }));
      message.error('工作流执行失败: ' + error.message);
    } finally {
      setIsExecuting(false);
      setAbortController(null);
    }
  };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', display: 'flex' }}>
      {/* Left Sidebar - Canvas List */}
      {(isMaximized || isStandalone) && (
        <div style={{
          width: leftCollapsed ? '0px' : '260px',
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          boxShadow: '4px 0 12px rgba(0,0,0,0.05)',
          transition: 'width 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 600, fontSize: '16px' }}>画布列表</span>
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined />}
              onClick={() => setLeftCollapsed(true)}
            />
          </div>

          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
            <Button
              type="primary"
              block
              icon={<PlusOutlined />}
              onClick={handleCreateCanvas}
              style={{ marginBottom: '8px' }}
            >
              新建画布
            </Button>

            <Button
              block
              icon={<SettingOutlined />}
              onClick={() => setShowToolboxManagement(true)}
              style={{ marginBottom: '16px' }}
            >
              工具箱管理
            </Button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {canvasList.map(canvas => (
                <div
                  key={canvas.id}
                  onClick={() => handleSwitchCanvas(canvas.id)}
                  style={{
                    padding: '8px',
                    background: canvas.active ? '#e6f7ff' : '#fafafa',
                    borderRadius: '4px',
                    border: canvas.active ? '1px solid #91d5ff' : '1px solid #f0f0f0',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  {editingCanvasId === canvas.id ? (
                    <Input
                      size="small"
                      value={editingCanvasName}
                      onChange={(e) => setEditingCanvasName(e.target.value)}
                      onPressEnter={() => handleCanvasRename(canvas.id, editingCanvasName)}
                      onBlur={() => handleCanvasRename(canvas.id, editingCanvasName)}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span>{canvas.name}</span>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCanvasId(canvas.id);
                          setEditingCanvasName(canvas.name);
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Left Expand Button */}
      {(isMaximized || isStandalone) && leftCollapsed && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: 0,
          zIndex: 3000
        }}>
          <Button
            type="primary"
            icon={<RightOutlined />}
            onClick={() => setLeftCollapsed(false)}
            style={{
              borderRadius: '0 6px 6px 0',
              boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
              height: '40px',
              width: '40px'
            }}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        position: 'relative'
      }}>
        {/* Canvas Area */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative'
        }}>
          <WorkflowCanvas
            steps={steps}
            onStepsChange={setSteps}
            tools={tools}
            onNodeExecute={handleNodeExecute}
            onGraphChange={handleGraphChange}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Bottom Action Bar */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #f0f0f0',
          background: '#fafafa',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
          <Button onClick={handleClearCanvas}>清空</Button>
          {isExecuting ? (
            <Button type="primary" danger onClick={handleAbortWorkflow}>
              暂停工作流
            </Button>
          ) : (
            <Button type="primary" onClick={handleExecuteWorkflow}>
              执行工作流
            </Button>
          )}
        </div>
      </div>

      {/* Right Sidebar - 执行看板 */}
      <div style={{
        width: outputPanelCollapsed ? '0px' : '50%',
        background: '#fff',
        borderLeft: '1px solid #f0f0f0',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.08)',
        transition: 'width 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff'
        }}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>执行看板</span>
          <Button
            type="text"
            icon={<RightOutlined />}
            onClick={() => setOutputPanelCollapsed(true)}
            title="隐藏面板"
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ExecutionPanel execution={execution} />
        </div>
      </div>

      {/* Right Expand Button */}
      {outputPanelCollapsed && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: 0,
          zIndex: 3000
        }}>
          <Button
            type="primary"
            icon={<LeftOutlined />}
            onClick={() => setOutputPanelCollapsed(false)}
            style={{
              borderRadius: '6px 0 0 6px',
              boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
              height: '40px',
              width: '40px'
            }}
            title="展开执行看板"
          />
        </div>
      )}

      {/* Floating Toolbox */}
      <FloatingToolbox
        onToolSelect={handleToolSelect}
      />

      {/* Toolbox Management Modal */}
      {showToolboxManagement && (
        <ToolboxManagement
          initialTool={selectedTool}
          onClose={() => {
            setShowToolboxManagement(false);
            setSelectedTool(null);
            fetchTools();
          }}
        />
      )}

      {/* Node Detail Panel */}
      {showNodeDetailPanel && (
        <ToolDetailPanel
          tool={selectedNodeForEdit}
          onClose={handleNodeDetailClose}
          onConfirm={handleNodeDetailConfirm}
        />
      )}
    </div>
  );
};

export default ResearchPlanEditor;
