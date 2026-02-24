import React, { useState, useEffect } from 'react';
import { Card, Collapse, Badge, Tooltip, Tag, Space, Popover } from 'antd';
import {
  DatabaseOutlined,
  BarChartOutlined,
  GlobalOutlined,
  FileTextOutlined,
  ApiOutlined,
  ExportOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../services/api';

const categoryLabels = {
  'data_extraction': '数据获取',
  'chart_creation': '图表制作',
  'product_research': '产品调研',
  'report_creation': '报告制作'
};

const categoryIcons = {
  'data_extraction': <DatabaseOutlined />,
  'chart_creation': <BarChartOutlined />,
  'product_research': <GlobalOutlined />,
  'report_creation': <FileTextOutlined />,
  // Fallback for old categories if any
  '数据类': <DatabaseOutlined />,
  '分析类': <BarChartOutlined />,
  '信息类': <GlobalOutlined />,
  '输出类': <FileTextOutlined />
};

const modelLabels = {
  'fast': { color: 'green', text: '快速' },
  'deep': { color: 'blue', text: '深度' },
  'image': { color: 'purple', text: '图像' }
};

const defaultTools = [
  // 数据获取
  { tool_id: 'corporate_data', tool_name: '企业数据', category: 'data_extraction', description: '获取企业工商信息、财务数据', config: { model: 'fast' } },
  { tool_id: 'news_search', tool_name: '新闻搜索', category: 'data_extraction', description: '搜索全网新闻资讯', config: { model: 'fast' } },
  { tool_id: 'patent_search', tool_name: '专利检索', category: 'data_extraction', description: '检索相关专利信息', config: { model: 'fast' } },

  // 图表制作
  { tool_id: 'market_share_chart', tool_name: '市场份额图', category: 'chart_creation', description: '生成市场份额饼图/柱状图', config: { model: 'image' } },
  { tool_id: 'trend_analysis_chart', tool_name: '趋势分析图', category: 'chart_creation', description: '生成历史趋势折线图', config: { model: 'image' } },

  // 案头调研
  { tool_id: 'competitor_analysis', tool_name: '竞品分析', category: 'desk_research', description: '分析竞争对手优劣势', config: { model: 'deep' } },
  { tool_id: 'policy_research', tool_name: '政策研究', category: 'desk_research', description: '研究相关行业政策法规', config: { model: 'deep' } },
  { tool_id: 'consumer_insight', tool_name: '消费者洞察', category: 'desk_research', description: '分析消费者行为和偏好', config: { model: 'deep' } },

  // 报告制作
  { tool_id: 'report_summary', tool_name: '报告总结', category: 'report_creation', description: '生成调研总结报告', config: { model: 'deep' } },
  { tool_id: 'ppt_generation', tool_name: 'PPT生成', category: 'report_creation', description: '生成汇报PPT大纲', config: { model: 'deep' } }
];

// Schema 预览组件
const SchemaPreview = ({ inputSchema, outputSchema }) => (
  <div style={{ fontSize: '12px', maxWidth: '280px' }}>
    {inputSchema && Object.keys(inputSchema).length > 0 && (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#1890ff' }}>
          <ApiOutlined /> 输入参数
        </div>
        <Space wrap size={[4, 4]}>
          {Object.entries(inputSchema).map(([key, type]) => (
            <Tag key={key} size="small" color="blue">
              {key}: {type}
            </Tag>
          ))}
        </Space>
      </div>
    )}
    {outputSchema && Object.keys(outputSchema).length > 0 && (
      <div>
        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#52c41a' }}>
          <ExportOutlined /> 输出参数
        </div>
        <Space wrap size={[4, 4]}>
          {Object.entries(outputSchema).map(([key, type]) => (
            <Tag key={key} size="small" color="green">
              {key}: {type}
            </Tag>
          ))}
        </Space>
      </div>
    )}
  </div>
);

const ToolPanel = ({ onToolSelect }) => {
  const [tools, setTools] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/research/tools`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      console.log('获取到的工具数据:', data);
      console.log('分类列表:', data.categories);
      if (data.tools && data.tools.length > 0) {
        setTools(data.tools);
        setCategories(data.categories || Object.keys(categoryLabels));
      } else {
        // Use defaults if API returns empty
        setTools(defaultTools);
        setCategories(Object.keys(categoryLabels));
      }
    } catch (error) {
      console.warn('获取工具列表失败，使用默认工具:', error);
      setTools(defaultTools);
      setCategories(Object.keys(categoryLabels));
    } finally {
      setLoading(false);
    }
  };
  const onDragStart = (event, tool) => {
    event.dataTransfer.setData('application/reactflow/type', 'custom');
    event.dataTransfer.setData('application/reactflow/tool', JSON.stringify(tool));
    event.dataTransfer.effectAllowed = 'move';
  };

  const groupedTools = categories.reduce((acc, category) => {
    acc[category] = tools.filter(t => t.category === category);
    return acc;
  }, {});

  const collapseItems = categories.map(category => ({
    key: category,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {categoryIcons[category]}
        <span>{categoryLabels[category] || category}</span>
        <Badge count={groupedTools[category]?.length || 0} />
      </div>
    ),
    children: (
      <>
        {groupedTools[category]?.map(tool => (
          <Popover
            key={tool.tool_id}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{tool.tool_name}</span>
                {tool.config?.model && (
                  <Tag size="small" color={modelLabels[tool.config.model]?.color}>
                    {modelLabels[tool.config.model]?.text}
                  </Tag>
                )}
              </div>
            }
            content={
              <div>
                <p style={{ color: '#666', marginBottom: '12px' }}>{tool.description}</p>
                <SchemaPreview
                  inputSchema={tool.input_schema}
                  outputSchema={tool.output_schema}
                />
              </div>
            }
            placement="left"
            trigger="hover"
          >
            <Card
              size="small"
              hoverable
              draggable
              onDragStart={(event) => onDragStart(event, tool)}
              onClick={() => onToolSelect(tool)}
              style={{
                marginBottom: '8px',
                cursor: 'grab',
                transition: 'all 0.2s ease'
              }}
              onDragEnd={(e) => {
                e.target.style.opacity = '1';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{tool.tool_name}</span>
                {tool.config?.model && (
                  <Tag size="small" color={modelLabels[tool.config.model]?.color}>
                    {modelLabels[tool.config.model]?.text}
                  </Tag>
                )}
              </div>
            </Card>
          </Popover>
        ))}
      </>
    )
  }));

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa'
      }}>
        <h3 style={{ margin: 0 }}>工具库</h3>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>
          悬停查看详情，点击添加步骤
        </p>
      </div>

      <Collapse
        defaultActiveKey={categories}
        ghost
        style={{ padding: '8px' }}
        items={collapseItems}
      />
    </div>
  );
};

export default ToolPanel;
