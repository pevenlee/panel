import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    Handle,
    Position,
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, Button, FloatButton, Input, Tag, Spin, message } from 'antd';
import { DeleteOutlined, PlusOutlined, CheckOutlined, CloseOutlined, EditOutlined, DatabaseOutlined, CloseCircleFilled, PlayCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const { TextArea } = Input;

// 数据源选项
const DATA_SOURCES = [
    { value: 'fact', label: '核心医院渠道', color: '#1890ff' },
    { value: 'ipmdata', label: '实体零售渠道', color: '#52c41a' },
    // 兼容旧的命名
    { value: 'hospital_sales', label: '医院销售数据', color: '#1890ff' },
    { value: 'retail_sales', label: '零售销售数据', color: '#52c41a' }
];

// 可删除的自定义连线
const DeletableEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data
}) => {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan"
                >
                    <Button
                        type="text"
                        size="small"
                        icon={<CloseCircleFilled style={{ fontSize: 16, color: '#ff4d4f' }} />}
                        onClick={() => data?.onDelete && data.onDelete(id)}
                        style={{
                            background: '#fff',
                            borderRadius: '50%',
                            padding: 0,
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                            cursor: 'pointer'
                        }}
                    />
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

// 可展开编辑的自定义节点
const ExpandableNode = ({ id, data, selected }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [stepName, setStepName] = useState('');
    const [selectedSources, setSelectedSources] = useState([]);
    const [dataRange, setDataRange] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);

    // 当展开时，用当前数据填充
    useEffect(() => {
        if (isExpanded) {
            setStepName(data.label || '');
            // 支持数组或单个值
            const sources = data.dataSources || (data.dataSource ? [data.dataSource] : ['hospital_sales']);
            setSelectedSources(Array.isArray(sources) ? sources : [sources]);
            setDataRange(data.description || '');
        }
    }, [isExpanded, data]);

    // 切换数据源选择
    const toggleSource = (value) => {
        setSelectedSources(prev => {
            if (prev.includes(value)) {
                return prev.filter(v => v !== value);
            } else {
                return [...prev, value];
            }
        });
    };

    // 保存编辑
    const handleSave = () => {
        if (data.onSave) {
            data.onSave({
                action: stepName,
                dataSources: selectedSources,
                rationale: dataRange,
                model: 'deep'
            });
        }
        setIsExpanded(false);
    };

    // 取消编辑
    const handleCancel = () => {
        setIsExpanded(false);
    };

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

    // 获取数据源显示
    const getSourceLabels = () => {
        const sources = data.dataSources || (data.dataSource ? [data.dataSource] : []);
        if (!sources.length) return '未选择数据源';
        return sources.map(v => {
            const s = DATA_SOURCES.find(ds => ds.value === v);
            return s ? s.label : v;
        }).join('、');
    };

    // 展开状态 - 显示编辑面板
    if (isExpanded) {
        return (
            <Card
                size="small"
                style={{
                    width: 300,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    border: 'none',
                    zIndex: 1000
                }}
                styles={{ body: { padding: '10px' } }}
            >
                <Handle type="target" position={Position.Top} style={{ background: '#1890ff' }} />
                
                {/* 标题栏 */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #f0f0f0'
                }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>步骤配置</span>
                    <Button
                        type="text"
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={handleCancel}
                        style={{ fontSize: '12px' }}
                    />
                </div>

                {/* 步骤名称 */}
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
                        步骤名称
                    </div>
                    <Input
                        size="small"
                        value={stepName}
                        onChange={(e) => setStepName(e.target.value)}
                        placeholder="输入步骤名称"
                        style={{ fontSize: '12px' }}
                    />
                </div>

                {/* 数据源选择 - 标签多选 */}
                <div style={{ marginBottom: '10px' }}>
                    <div style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#666',
                        marginBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <DatabaseOutlined style={{ color: '#1890ff' }} />
                        数据源（可多选）
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {DATA_SOURCES.map(source => {
                            const isSelected = selectedSources.includes(source.value);
                            return (
                                <Tag
                                    key={source.value}
                                    onClick={() => toggleSource(source.value)}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        border: isSelected ? `1px solid ${source.color}` : '1px solid #d9d9d9',
                                        backgroundColor: isSelected ? `${source.color}10` : '#fff',
                                        color: isSelected ? source.color : '#666',
                                        transition: 'all 0.2s ease',
                                        userSelect: 'none'
                                    }}
                                >
                                    {isSelected && <CheckOutlined style={{ marginRight: 4, fontSize: 10 }} />}
                                    {source.label}
                                </Tag>
                            );
                        })}
                    </div>
                </div>

                {/* 数据范围说明 */}
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
                        数据范围说明
                    </div>
                    <TextArea
                        size="small"
                        value={dataRange}
                        onChange={(e) => setDataRange(e.target.value)}
                        rows={3}
                        placeholder="描述需要调取的数据范围，例如：&#10;• 时间：2023年-2024年&#10;• 产品：XXX品类&#10;• 地区：全国"
                        style={{ fontSize: '11px', resize: 'none' }}
                    />
                </div>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Button size="small" onClick={handleCancel} style={{ fontSize: '11px' }}>
                        取消
                    </Button>
                    <Button
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={handleSave}
                        style={{ fontSize: '11px' }}
                    >
                        保存
                    </Button>
                </div>
                
                <Handle type="source" position={Position.Bottom} style={{ background: '#1890ff' }} />
            </Card>
        );
    }

    // 收起状态 - 显示简洁卡片
    const sources = data.dataSources || (data.dataSource ? [data.dataSource] : []);
    
    return (
        <Card
            size="small"
            styles={{ body: { padding: '8px' } }}
            style={{
                width: 240,
                border: selected ? '2px solid #1890ff' : '1px solid #e8e8e8',
                boxShadow: selected ? '0 4px 12px rgba(24,144,255,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                borderRadius: '8px'
            }}
            onClick={(e) => {
                e.stopPropagation();
                // 优先使用 onNodeClick 打开右侧详情面板
                if (data.onNodeClick) {
                    data.onNodeClick(id);
                } else {
                    setIsExpanded(true);
                }
            }}
        >
            <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
            
            {/* 标题行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                        fontWeight: 600,
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: '#333'
                    }}>
                        {data.label}
                    </div>
                </div>
                <Button
                    type="text"
                    size="small"
                    icon={isExecuting ? <LoadingOutlined style={{ fontSize: 12 }} /> : <PlayCircleOutlined style={{ fontSize: 12 }} />}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleExecuteNode();
                    }}
                    disabled={isExecuting}
                    style={{ color: '#52c41a', padding: '0 4px' }}
                    title="执行此节点"
                />
                <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined style={{ fontSize: 12 }} />}
                    onClick={(e) => {
                        e.stopPropagation();
                        // 如果有 onNodeClick 回调，调用它打开统一的详情面板
                        if (data.onNodeClick) {
                            data.onNodeClick(id);
                        } else {
                            // 否则使用内置的展开编辑
                            setIsExpanded(true);
                        }
                    }}
                    style={{ color: '#1890ff', padding: '0 4px' }}
                />
                {data.onDelete && (
                    <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                        onClick={(e) => {
                            e.stopPropagation();
                            data.onDelete();
                        }}
                        style={{ padding: '0 4px' }}
                    />
                )}
            </div>

            {/* 数据源标签 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                {sources.length > 0 ? sources.map(v => {
                    const s = DATA_SOURCES.find(ds => ds.value === v);
                    if (!s) return null;
                    return (
                        <Tag
                            key={v}
                            style={{
                                fontSize: '10px',
                                padding: '0 6px',
                                margin: 0,
                                borderRadius: '3px',
                                border: `1px solid ${s.color}`,
                                backgroundColor: `${s.color}10`,
                                color: s.color
                            }}
                        >
                            {s.label}
                        </Tag>
                    );
                }) : (
                    <span style={{ fontSize: '10px', color: '#999' }}>未选择数据源</span>
                )}
            </div>

            {/* 数据范围摘要 */}
            <div style={{
                fontSize: '10px',
                color: '#888',
                background: '#fafafa',
                padding: '4px 6px',
                borderRadius: '4px',
                lineHeight: '1.4'
            }}>
                {data.description ? (
                    data.description.length > 40 ? data.description.substring(0, 40) + '...' : data.description
                ) : (
                    <span style={{ color: '#bbb' }}>点击配置数据范围...</span>
                )}
            </div>
            
            <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
        </Card>
    );
};

const nodeTypes = {
    custom: ExpandableNode,
};

const edgeTypes = {
    deletable: DeletableEdge,
};

const WorkflowCanvas = ({ steps, onStepsChange, tools, onNodeExecute, onGraphChange, onNodeClick }) => {
    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // 使用 ref 保存最新的 nodes 和 edges
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);

    useEffect(() => {
        nodesRef.current = nodes;
        edgesRef.current = edges;
    }, [nodes, edges]);

    // 用 ref 保存最新的 steps
    const stepsRef = useRef(steps);
    useEffect(() => { stepsRef.current = steps; }, [steps]);

    // 用于判断是否需要从 steps 重建 nodes
    const stepsSignature = useMemo(() => {
        if (!steps || steps.length === 0) return '';
        return steps.map(s => {
            // 必须与 newNodes 的默认值逻辑保持完全一致
            const rawSources = s.dataSources || ['hospital_sales'];
            const dataSources = rawSources.sort().join(',');
            
            // 必须与 newNodes 的 description 逻辑保持一致 (s.rationale || s.description)
            // 之前使用了 s.custom_prompt，导致与 newNodes (使用 rationale) 不一致，引发死循环
            const customPrompt = s.rationale || s.description || '';
            
            return `${s.id || ''}:${s.action || s.title || ''}:${dataSources}:${customPrompt}`;
        }).join('|');
    }, [steps]);

    // 通知父组件图结构变化
    useEffect(() => {
        if (onGraphChange && nodes.length > 0) {
            onGraphChange(nodes, edges);
        }
    }, [nodes, edges, onGraphChange]);

    // 删除连线
    const handleDeleteEdge = useCallback((edgeId) => {
        setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    }, [setEdges]);

    const onConnect = useCallback((params) => {
        const newEdge = {
            ...params,
            type: 'deletable',
            animated: true,
            style: { stroke: '#1890ff', strokeWidth: 2 },
            data: { onDelete: handleDeleteEdge }
        };
        setEdges((eds) => addEdge(newEdge, eds));
    }, [setEdges, handleDeleteEdge]);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // 删除节点
    const handleDeleteNode = useCallback((id) => {
        console.log('[WorkflowCanvas] 删除节点:', id);

        // 删除节点和相关连线
        setNodes((nds) => {
            const filtered = nds.filter((node) => node.id !== id);
            console.log('[WorkflowCanvas] 删除后 nodes 数量:', filtered.length);
            return filtered;
        });
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));

        // 同步删除 steps 中的对应数据
        onStepsChange((prevSteps) => {
            const filtered = prevSteps.filter((step) => step.id?.toString() !== id.toString());
            console.log('[WorkflowCanvas] 删除后 steps 数量:', filtered.length);
            return filtered;
        });
    }, [setNodes, setEdges, onStepsChange]);

    // 执行单个节点
    const handleExecuteNode = useCallback(async (nodeId) => {
        if (!onNodeExecute) return;

        console.log(`[WorkflowCanvas] 开始执行节点: ${nodeId}, 类型: ${typeof nodeId}`);

        // 使用 ref 获取最新的 nodes 和 edges
        const currentNodes = nodesRef.current;
        const currentEdges = edgesRef.current;

        console.log(`[WorkflowCanvas] 当前节点总数: ${currentNodes.length}`);

        // 获取当前节点 - 确保ID类型匹配
        const currentNode = currentNodes.find(n => n.id == nodeId || n.id === nodeId.toString());
        if (!currentNode) {
            console.error(`[WorkflowCanvas] 未找到节点: ${nodeId}`);
            console.log(`[WorkflowCanvas] 当前所有节点:`, currentNodes.map(n => ({ id: n.id, type: typeof n.id })));
            return;
        }

        console.log(`[WorkflowCanvas] 找到节点:`, currentNode);

        // 查找输入节点（通过连线）
        const inputEdges = currentEdges.filter(e => e.target == nodeId || e.target === nodeId.toString());
        const inputNodeIds = inputEdges.map(e => e.source);

        console.log(`[WorkflowCanvas] 节点 ${nodeId} 有 ${inputEdges.length} 个输入连线`);
        console.log(`[WorkflowCanvas] 输入节点IDs:`, inputNodeIds);

        // 获取输入数据
        const inputData = inputNodeIds.map(inputId => {
            const inputNode = currentNodes.find(n => n.id == inputId || n.id === inputId.toString());
            return inputNode?.data?.executionResult || null;
        }).filter(Boolean);

        console.log(`[WorkflowCanvas] 获取到 ${inputData.length} 个有效输入数据`);

        // 调用父组件的执行函数
        await onNodeExecute(nodeId, currentNode.data, inputData);
    }, [onNodeExecute]);

    // 保存节点编辑 - 更新 steps
    const handleSaveNode = useCallback((nodeId, values) => {
        onStepsChange(prevSteps => {
            return prevSteps.map(step => {
                if (step.id != null && step.id.toString() === nodeId) {
                    return {
                        ...step,
                        action: values.action,
                        rationale: values.rationale,
                        dataSources: values.dataSources || [],
                        model: values.model || 'deep'
                    };
                }
                return step;
            });
        });

        // 同时更新节点显示
        setNodes(nds => nds.map(node => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        label: values.action,
                        description: values.rationale,
                        dataSources: values.dataSources || [],
                        model: values.model || 'deep'
                    }
                };
            }
            return node;
        }));
    }, [onStepsChange, setNodes]);

    // steps -> nodes：仅当 stepsSignature 变化时重建，保留已有节点位置和连线
    useEffect(() => {
        console.log('[WorkflowCanvas] steps 变化，当前 steps 数量:', steps?.length || 0);
        console.log('[WorkflowCanvas] 当前 nodes 数量:', nodes.length);

        if (!steps || steps.length === 0) {
            if (nodes.length > 0) {
                console.log('[WorkflowCanvas] steps 为空，清空 nodes');
                setNodes([]);
                setEdges([]);
            }
            return;
        }

        // 检查现有 nodes 是否已匹配
        const currentSig = nodes.map(n => {
            const dataSources = (n.data.dataSources || []).sort().join(',');
            const customPrompt = n.data.description || '';
            return `${n.id}:${n.data.label || ''}:${dataSources}:${customPrompt}`;
        }).join('|');
        if (currentSig === stepsSignature) {
            console.log('[WorkflowCanvas] 签名匹配，跳过更新');
            return;
        }

        console.log('[WorkflowCanvas] 签名不匹配，重建 nodes');
        console.log('[WorkflowCanvas] 旧签名:', stepsSignature);
        console.log('[WorkflowCanvas] 新签名:', steps.map(s => `${s.id}:${s.action}:${(s.dataSources || []).join(',')}`).join('|'));

        // 创建现有节点位置的映射
        const existingPositions = {};
        const existingNodeIds = new Set();
        nodes.forEach(n => {
            existingPositions[n.id] = n.position;
            existingNodeIds.add(n.id);
        });

        const newNodes = steps.map((step, index) => {
            const nodeId = step.id ? step.id.toString() : `node-${index}-${Date.now()}`;
            // 位置优先级：1. 已存在节点的位置 2. 拖动时保存的位置 3. 默认位置
            const position = existingPositions[nodeId] || step.position || { x: 450, y: 80 + index * 150 };
            return {
                id: nodeId,
                type: 'custom',
                position,
                data: {
                    label: step.action || step.title,
                    phase: step.phase,
                    description: step.rationale || step.description,
                    tool_id: step.tool_id,
                    dataSources: step.dataSources || ['hospital_sales'],
                    model: step.model || 'deep',
                    executionResult: step.data || null, // 传递执行结果供下游节点使用
                    onDelete: () => handleDeleteNode(nodeId),
                    onSave: (values) => handleSaveNode(nodeId, values),
                    onExecute: handleExecuteNode,
                    onNodeClick: onNodeClick
                },
            };
        });

        // 保留现有的连线（只过滤掉已删除节点相关的连线）
        const newNodeIds = new Set(newNodes.map(n => n.id));
        setEdges(currentEdges => {
            return currentEdges.filter(edge => 
                newNodeIds.has(edge.source) && newNodeIds.has(edge.target)
            );
        });

        setNodes(newNodes);
    }, [steps, stepsSignature, handleDeleteNode, handleSaveNode]);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
            const toolDataStr = event.dataTransfer.getData('application/reactflow/tool');

            if (!toolDataStr) return;

            const tool = JSON.parse(toolDataStr);

            const position = {
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            };

            const nodeId = Date.now();

            // 创建完整的 step 数据，与点击添加保持一致
            const newStep = {
                id: nodeId,
                action: tool.tool_name || `使用${tool.tool_name}`,
                tool_id: tool.tool_id,
                rationale: '',
                custom_prompt: '',
                dataSources: tool.databases || ['hospital_sales'],
                preset_question: '',
                time_range: 365,
                model: 'deep',
                input_schema: tool.input_schema,
                output_schema: tool.output_schema,
                // 保存拖动位置信息
                position: position
            };

            console.log('[WorkflowCanvas] 拖动添加工具:', newStep);

            // 通过 onStepsChange 添加到 steps，让其自动同步到 nodes
            onStepsChange((prevSteps) => {
                const updatedSteps = [...prevSteps, newStep];
                console.log('[WorkflowCanvas] 拖动后 steps 数量:', updatedSteps.length);
                return updatedSteps;
            });
        },
        [onStepsChange]
    );

    // 节点变化时同步回父组件
    const lastSyncedNodesSignature = useRef('');

    useEffect(() => {
        if (nodes.length === 0) {
            lastSyncedNodesSignature.current = '';
            return;
        }

        const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
        const currentSignature = sortedNodes.map(n => `${n.id}:${n.data.label}:${n.data.tool_id}:${(n.data.dataSources || []).join(',')}`).join('|');

        if (currentSignature === lastSyncedNodesSignature.current) {
            return;
        }

        console.log('[WorkflowCanvas] nodes 变化，同步回 steps');
        console.log('[WorkflowCanvas] 当前 nodes 数量:', nodes.length);
        console.log('[WorkflowCanvas] 上次签名:', lastSyncedNodesSignature.current);
        console.log('[WorkflowCanvas] 当前签名:', currentSignature);

        lastSyncedNodesSignature.current = currentSignature;

        onStepsChange(prevSteps => {
            const newSteps = sortedNodes.map(node => {
                const existing = prevSteps.find(s => s.id != null && s.id.toString() === node.id);

                // 如果找到已存在的步骤，优先保留其配置
                if (existing) {
                    return {
                        ...existing,
                        // 只更新可能在画布上改变的字段
                        action: node.data.label || existing.action,
                        rationale: node.data.description || existing.rationale,
                        // 只有当节点数据明确提供时才更新，否则保留原值
                        dataSources: (node.data.dataSources && node.data.dataSources.length > 0)
                            ? node.data.dataSources
                            : existing.dataSources || [],
                        model: node.data.model || existing.model || 'deep'
                    };
                } else {
                    // 新节点，使用节点数据创建
                    return {
                        id: node.id,
                        action: node.data.label,
                        tool_id: node.data.tool_id,
                        rationale: node.data.description || '',
                        dataSources: node.data.dataSources || [],
                        model: node.data.model || 'deep',
                        custom_prompt: '',
                        preset_question: '',
                        time_range: 365
                    };
                }
            });

            console.log('[WorkflowCanvas] 同步后的 steps 数量:', newSteps.length);
            return newSteps;
        });
    }, [nodes, onStepsChange]);

    // 只在首次有节点时 fitView 一次
    const hasInitialFit = useRef(false);
    const reactFlowInstance = useRef(null);

    const handleInit = useCallback((instance) => {
        reactFlowInstance.current = instance;
        // 首次初始化且有节点时，fitView 一次
        if (!hasInitialFit.current && nodes.length > 0) {
            instance.fitView({ padding: 0.2 });
            hasInitialFit.current = true;
        }
    }, [nodes.length]);

    // 如果初始化时没有节点，在第一次有节点时 fitView
    useEffect(() => {
        if (!hasInitialFit.current && nodes.length > 0 && reactFlowInstance.current) {
            reactFlowInstance.current.fitView({ padding: 0.2 });
            hasInitialFit.current = true;
        }
    }, [nodes.length]);

    return (
        <div style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={handleInit}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                snapToGrid={true}
                snapGrid={[15, 15]}
                defaultEdgeOptions={{
                    animated: true,
                    style: { stroke: '#1890ff', strokeWidth: 2 }
                }}
                connectionLineStyle={{ stroke: '#1890ff', strokeWidth: 2 }}
                nodesDraggable={true}
                nodesConnectable={true}
                elementsSelectable={true}
                selectNodesOnDrag={false}
                panOnDrag={[1, 2]}
                minZoom={0.5}
                maxZoom={1.5}
            >
                <Controls />
                <Background variant="dots" gap={12} size={1} />
            </ReactFlow>

            <FloatButton
                icon={<PlusOutlined />}
                type="primary"
                style={{ right: 24, bottom: 24 }}
                onClick={() => {
                    const nodeId = Date.now().toString();
                    const newNode = {
                        id: nodeId,
                        type: 'custom',
                        position: { x: 450 + Math.random() * 30, y: 80 + nodes.length * 150 },
                        data: {
                            label: '新步骤',
                            phase: 'New',
                            description: '',
                            tool_id: '',
                            dataSources: ['hospital_sales'],
                            model: 'deep',
                            onDelete: () => handleDeleteNode(nodeId),
                            onSave: (values) => handleSaveNode(nodeId, values),
                            onExecute: handleExecuteNode,
                            onNodeClick: onNodeClick
                        },
                    };
                    setNodes((nds) => nds.concat(newNode));
                }}
                tooltip={<div>添加新节点</div>}
            />
        </div>
    );
};

const WorkflowCanvasWrapper = (props) => (
    <ReactFlowProvider>
        <WorkflowCanvas {...props} />
    </ReactFlowProvider>
);

export default WorkflowCanvasWrapper;
