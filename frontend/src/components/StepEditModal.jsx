import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Collapse, Tag, Space, Descriptions, message } from 'antd';
import { SettingOutlined, ApiOutlined, ExportOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../services/api';

const { TextArea } = Input;
const { Panel } = Collapse;

const StepEditModal = ({ visible, step, tools, onSave, onCancel }) => {
  const [form] = Form.useForm();
  const [selectedTool, setSelectedTool] = useState(null);
  const [models, setModels] = useState([]);
  const [defaultModel, setDefaultModel] = useState('fast');

  // 获取可用模型列表
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/research/models`);
        const data = await response.json();
        setModels(data.models || []);
        setDefaultModel(data.default || 'fast');
      } catch (error) {
        console.error('获取模型列表失败:', error);
      }
    };
    fetchModels();
  }, []);

  // 当弹窗打开时，用 step 数据填充表单
  useEffect(() => {
    if (visible && step) {
      // 先找到对应的工具
      const tool = tools.find(t => t.tool_id === step.tool_id);
      setSelectedTool(tool);

      // 填充表单 - 优先使用 step 已保存的值
      form.setFieldsValue({
        action: step.action || step.phase || '',
        tool_id: step.tool_id || '',
        rationale: step.rationale || '',
        model: step.model || tool?.config?.model || defaultModel,
        input_config: step.input_config || {},
        timeout: step.timeout || 60
      });
    }
  }, [visible, step, tools, form, defaultModel]);

  // 当弹窗关闭时重置表单，避免残留
  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setSelectedTool(null);
    }
  }, [visible, form]);

  const handleToolChange = (toolId) => {
    const tool = tools.find(t => t.tool_id === toolId);
    setSelectedTool(tool);
    // 自动设置工具推荐的模型
    if (tool?.config?.model) {
      form.setFieldsValue({ model: tool.config.model });
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSave({
        ...values,
        input_schema: selectedTool?.input_schema,
        output_schema: selectedTool?.output_schema
      });
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // 渲染 Schema 字段
  const renderSchemaFields = (schema, type) => {
    if (!schema || Object.keys(schema).length === 0) {
      return <span style={{ color: '#999' }}>无{type === 'input' ? '输入' : '输出'}参数</span>;
    }
    return (
      <Space wrap size={[8, 8]}>
        {Object.entries(schema).map(([key, valueType]) => (
          <Tag
            key={key}
            color={type === 'input' ? 'blue' : 'green'}
            style={{ margin: 0 }}
          >
            {key}: <span style={{ fontFamily: 'monospace' }}>{valueType}</span>
          </Tag>
        ))}
      </Space>
    );
  };

  return (
    <Modal
      title="编辑调研步骤"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={700}
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          label="步骤名称"
          name="action"
          rules={[{ required: true, message: '请输入步骤名称' }]}
        >
          <Input placeholder="例如：识别分析对象" />
        </Form.Item>

        <Form.Item
          label="选择工具"
          name="tool_id"
          rules={[{ required: true, message: '请选择工具' }]}
        >
          <Select
            placeholder="选择一个工具"
            onChange={handleToolChange}
          >
            {tools.map(tool => (
              <Select.Option key={tool.tool_id} value={tool.tool_id}>
                <span style={{ marginRight: '8px' }}>{tool.icon}</span>
                {tool.tool_name}
                <Tag size="small" style={{ marginLeft: '8px' }}>{tool.category}</Tag>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {selectedTool && (
          <div style={{
            padding: '12px',
            background: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              <strong>工具说明：</strong> {selectedTool.description}
            </div>
          </div>
        )}

        <Form.Item
          label={
            <span>
              <ApiOutlined style={{ marginRight: '4px' }} />
              执行模型
            </span>
          }
          name="model"
          tooltip="选择执行此步骤使用的 AI 模型"
        >
          <Select placeholder="选择执行模型">
            {models.map(model => (
              <Select.Option key={model.id} value={model.id}>
                <div>
                  <span style={{ fontWeight: 500 }}>{model.name}</span>
                  <span style={{ color: '#999', fontSize: '12px', marginLeft: '8px' }}>
                    {model.description}
                  </span>
                </div>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {selectedTool && (
          <Collapse
            ghost
            style={{ marginBottom: '16px' }}
            items={[
              {
                key: 'io',
                label: (
                  <span style={{ fontSize: '13px' }}>
                    <SettingOutlined style={{ marginRight: '4px' }} />
                    输入/输出参数
                  </span>
                ),
                children: (
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item
                      label={
                        <span>
                          <ApiOutlined style={{ color: '#1890ff', marginRight: '4px' }} />
                          输入参数
                        </span>
                      }
                    >
                      {renderSchemaFields(selectedTool.input_schema, 'input')}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <span>
                          <ExportOutlined style={{ color: '#52c41a', marginRight: '4px' }} />
                          输出参数
                        </span>
                      }
                    >
                      {renderSchemaFields(selectedTool.output_schema, 'output')}
                    </Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: 'advanced',
                label: (
                  <span style={{ fontSize: '13px' }}>
                    <SettingOutlined style={{ marginRight: '4px' }} />
                    高级配置
                  </span>
                ),
                children: (
                  <Form.Item
                    label="超时时间（秒）"
                    name="timeout"
                  >
                    <Input type="number" min={10} max={300} placeholder="60" />
                  </Form.Item>
                )
              }
            ]}
          />
        )}

        <Form.Item
          label="步骤说明"
          name="rationale"
        >
          <TextArea
            rows={3}
            placeholder="描述这个步骤的目的和预期产出"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default StepEditModal;
