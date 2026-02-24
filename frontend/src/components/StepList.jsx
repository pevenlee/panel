import React from 'react';
import { Card, Button, Space, Tooltip, Tag } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  ApiOutlined
} from '@ant-design/icons';

const modelLabels = {
  'fast': { color: 'green', text: '快速模型' },
  'deep': { color: 'blue', text: '深度模型' },
  'image': { color: 'purple', text: '图像模型' }
};

const StepList = ({ steps, onEdit, onDelete, onMoveUp, onMoveDown, onAdd }) => {
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3>调研步骤</h3>
        <p style={{ fontSize: '12px', color: '#666' }}>
          共 {steps.length} 个步骤
        </p>
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {steps.map((step, index) => (
          <Card
            key={step.id}
            size="small"
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: '#1890ff',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  minWidth: '24px', // Prevent shrinking
                  flexShrink: 0,    // Prevent shrinking
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px'
                }}>
                  {index + 1}
                </span>
                <span>{step.action || step.phase}</span>
                {step.model && modelLabels[step.model] && (
                  <Tag size="small" color={modelLabels[step.model].color} icon={<ApiOutlined />}>
                    {modelLabels[step.model].text}
                  </Tag>
                )}
              </div>
            }
            extra={
              <Space>
                <Tooltip title="编辑">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => onEdit(step, index)}
                  />
                </Tooltip>
                <Tooltip title="删除">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(index)}
                  />
                </Tooltip>
                <Tooltip title="上移">
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => onMoveUp(index)}
                  />
                </Tooltip>
                <Tooltip title="下移">
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowDownOutlined />}
                    disabled={index === steps.length - 1}
                    onClick={() => onMoveDown(index)}
                  />
                </Tooltip>
              </Space>
            }
          >
            <div style={{ fontSize: '12px', color: '#666' }}>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>工具:</strong>
                <span>{step.tool_id || '未指定'}</span>
              </div>
              {step.input_schema && Object.keys(step.input_schema).length > 0 && (
                <div style={{ marginBottom: '4px' }}>
                  <strong>输入:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {Object.keys(step.input_schema).join(', ')}
                  </span>
                </div>
              )}
              {step.output_schema && Object.keys(step.output_schema).length > 0 && (
                <div style={{ marginBottom: '4px' }}>
                  <strong>输出:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {Object.keys(step.output_schema).join(', ')}
                  </span>
                </div>
              )}
              <div>
                <strong>说明:</strong> {step.rationale || step.expected_output || '无'}
              </div>
            </div>
          </Card>
        ))}
      </Space>

      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={onAdd}
        style={{ marginTop: '16px' }}
      >
        添加步骤
      </Button>
    </div>
  );
};

export default StepList;
