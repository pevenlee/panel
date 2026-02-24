import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Tooltip } from 'antd';
import {
  DatabaseOutlined,
  BarChartOutlined,
  GlobalOutlined,
  FileTextOutlined,
  MinusOutlined,
  PlusOutlined,
  DragOutlined
} from '@ant-design/icons';
import CubeSalesModal from './CubeSalesModal';
import ToolDetailPanel from './ToolDetailPanel';
import { API_BASE_URL } from '../services/api';

const categoryIcons = {
  'data_extraction': <DatabaseOutlined />,
  'chart_creation': <BarChartOutlined />,
  'product_research': <GlobalOutlined />,
  'report_creation': <FileTextOutlined />
};

const categoryLabels = {
  'data_extraction': '数据获取',
  'chart_creation': '图表制作',
  'product_research': '产品调研',
  'report_creation': '报告制作'
};

const defaultTools = [
  // 数据获取
  { tool_id: 'cube_sales_data', tool_name: '魔方销售数据', category: 'data_extraction', description: '获取魔方系统的销售数据', config: { model: 'fast' } },
  { tool_id: 'retail_sales_data', tool_name: '零售销售数据', category: 'data_extraction', description: '获取零售渠道的销售数据', config: { model: 'fast' } },
  { tool_id: 'research_sales_data', tool_name: '调研销售数据', category: 'data_extraction', description: '获取市场调研的销售数据', config: { model: 'fast' } },

  // 图表制作
  { tool_id: 'recommended_chart', tool_name: '推荐图表制作', category: 'chart_creation', description: 'AI自动推荐最适合的图表类型', config: { model: 'image' } },
  { tool_id: 'custom_chart', tool_name: '自定义图表制作', category: 'chart_creation', description: '自定义图表样式和数据展示', config: { model: 'image' } },

  // 产品调研
  { tool_id: 'financial_report', tool_name: '财报信息', category: 'product_research', description: '获取企业财务报告和经营数据', config: { model: 'deep' } },
  { tool_id: 'public_opinion', tool_name: '舆情信息', category: 'product_research', description: '分析产品和品牌舆情动态', config: { model: 'deep' } },
  { tool_id: 'clinical_info', tool_name: '临床信息', category: 'product_research', description: '获取药品临床试验和研究信息', config: { model: 'deep' } },
  { tool_id: 'approval_info', tool_name: '申报审批', category: 'product_research', description: '查询药品申报和审批进度', config: { model: 'deep' } },
  { tool_id: 'drug_trading', tool_name: '药品交易', category: 'product_research', description: '获取药品交易和流通数据', config: { model: 'deep' } }
];

const FloatingToolbox = ({ onToolSelect, onToolManage }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 5, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tools, setTools] = useState([]);
  const [cubeSalesModalVisible, setCubeSalesModalVisible] = useState(false);
  const [pendingTool, setPendingTool] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedToolForDetail, setSelectedToolForDetail] = useState(null);
  const toolboxRef = useRef(null);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/research/tools`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      if (data.tools && data.tools.length > 0) {
        setTools(data.tools);
      } else {
        setTools(defaultTools);
      }
    } catch (error) {
      console.warn('获取工具列表失败，使用默认工具:', error);
      setTools(defaultTools);
    }
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleToolClick = (e, tool) => {
    e.stopPropagation();
    console.log('Tool clicked:', tool.tool_id);

    // 显示工具详情面板
    setSelectedToolForDetail(tool);
    setShowDetailPanel(true);
  };

  const handleDetailPanelConfirm = (toolWithConfig) => {
    // 将配置好的工具添加到画布
    onToolSelect(toolWithConfig);
    setShowDetailPanel(false);
    setSelectedToolForDetail(null);
  };

  const handleDetailPanelClose = () => {
    setShowDetailPanel(false);
    setSelectedToolForDetail(null);
  };

  const handleCubeSalesConfirm = (config) => {
    // 将配置信息附加到工具上
    const toolWithConfig = {
      ...pendingTool,
      config: {
        ...pendingTool.config,
        dataSources: config.dataSources,
        queryText: config.queryText,
        selectedSources: config.selectedSources
      }
    };

    onToolSelect(toolWithConfig);
    setCubeSalesModalVisible(false);
    setPendingTool(null);
  };

  const handleCubeSalesCancel = () => {
    setCubeSalesModalVisible(false);
    setPendingTool(null);
  };

  const onDragStart = (event, tool) => {
    event.dataTransfer.setData('application/reactflow/type', 'custom');
    event.dataTransfer.setData('application/reactflow/tool', JSON.stringify(tool));
    event.dataTransfer.effectAllowed = 'move';
  };

  const groupedTools = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {});

  const categoryOrder = ['data_extraction', 'chart_creation', 'product_research', 'report_creation'];

  return (
    <>
      <div
        ref={toolboxRef}
        style={{
          position: 'fixed',
          left: position.x + 'px',
          top: position.y + 'px',
          zIndex: 1000,
          cursor: isDragging ? 'grabbing' : 'default',
          userSelect: 'none'
        }}
      >
        <Card
        size="small"
        style={{
          width: collapsed ? '160px' : '280px',
          maxHeight: '480px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderRadius: '8px',
          transition: 'width 0.3s ease'
        }}
        styles={{
          body: { padding: collapsed ? '6px' : '10px' }
        }}
      >
        <div
          className="drag-header"
          onMouseDown={handleMouseDown}
          style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: collapsed ? 0 : '8px',
          paddingBottom: collapsed ? 0 : '6px',
          borderBottom: collapsed ? 'none' : '1px solid #f0f0f0',
          cursor: 'grab'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DragOutlined
              className="drag-handle"
              style={{ cursor: 'grab', color: '#999', fontSize: '12px' }}
            />
            {!collapsed && (
              <span style={{ fontWeight: 600, fontSize: '13px' }}>工具箱</span>
            )}
          </div>
          <Button
            type="text"
            size="small"
            icon={collapsed ? <PlusOutlined /> : <MinusOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "展开" : "收起"}
            style={{ fontSize: '12px' }}
          />
        </div>

        {!collapsed && (
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {categoryOrder.map((category, idx) => {
              const categoryTools = groupedTools[category] || [];
              if (categoryTools.length === 0) return null;

              return (
                <div key={category}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#666',
                    marginBottom: '6px',
                    marginTop: idx > 0 ? '8px' : '0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ color: '#1890ff', fontSize: '14px' }}>
                      {categoryIcons[category]}
                    </span>
                    <span>{categoryLabels[category]}</span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '6px',
                    marginBottom: '4px'
                  }}>
                    {categoryTools.map(tool => (
                      <Tooltip
                        key={tool.tool_id}
                        title={tool.description}
                        placement="top"
                      >
                        <div
                          draggable
                          onDragStart={(event) => onDragStart(event, tool)}
                          onClick={(e) => handleToolClick(e, tool)}
                          style={{
                            cursor: 'pointer',
                            padding: '6px',
                            textAlign: 'center',
                            border: '1px solid #e8e8e8',
                            borderRadius: '4px',
                            transition: 'all 0.2s ease',
                            backgroundColor: '#fff',
                            fontSize: '11px',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#1890ff';
                            e.currentTarget.style.backgroundColor = '#f0f7ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e8e8e8';
                            e.currentTarget.style.backgroundColor = '#fff';
                          }}
                        >
                          {tool.tool_name}
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>

    {/* 魔方销售数据配置弹窗 */}
    <CubeSalesModal
      visible={cubeSalesModalVisible}
      onCancel={handleCubeSalesCancel}
      onConfirm={handleCubeSalesConfirm}
    />

    {/* 工具详情面板 */}
    {showDetailPanel && (
      <ToolDetailPanel
        tool={selectedToolForDetail}
        onClose={handleDetailPanelClose}
        onConfirm={handleDetailPanelConfirm}
      />
    )}
    </>
  );
};

export default FloatingToolbox;
