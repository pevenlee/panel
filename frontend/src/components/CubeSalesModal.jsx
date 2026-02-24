import React, { useState } from 'react';
import { Modal, Checkbox, Input, Button, Space, message } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const CubeSalesModal = ({ visible, onCancel, onConfirm }) => {
  const [dataSources, setDataSources] = useState({
    urbanHospital: false,
    retailPharmacy: false
  });

  const [queryText, setQueryText] = useState('');

  const dataSourceLabels = {
    urbanHospital: '城市核心医院 (IPM数据)',
    retailPharmacy: '实体零售药房 (Fact数据)'
  };

  const handleDataSourceChange = (key, checked) => {
    setDataSources({ ...dataSources, [key]: checked });
  };

  const handleConfirm = () => {
    const selectedSources = Object.keys(dataSources).filter(key => dataSources[key]);

    if (selectedSources.length === 0) {
      message.warning('请至少选择一个数据源');
      return;
    }

    if (!queryText.trim()) {
      message.warning('请输入数据查询需求');
      return;
    }

    // 传递配置信息给父组件
    onConfirm({
      dataSources,
      queryText,
      selectedSources
    });

    // 重置表单
    setDataSources({
      urbanHospital: false,
      retailPharmacy: false
    });
    setQueryText('');
  };

  const handleCancel = () => {
    // 重置表单
    setDataSources({
      urbanHospital: false,
      retailPharmacy: false
    });
    setQueryText('');
    onCancel();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DatabaseOutlined style={{ color: '#1890ff' }} />
          <span>魔方销售数据配置</span>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      onOk={handleConfirm}
      width={500}
      okText="确认添加"
      cancelText="取消"
      zIndex={2000}
      destroyOnClose={true}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 数据源选择 */}
        <div>
          <div style={{ marginBottom: 12, fontWeight: 500, fontSize: '14px', color: '#333' }}>
            选择数据源：
          </div>
          <Space direction="vertical" size="middle">
            {Object.keys(dataSourceLabels).map(key => (
              <Checkbox
                key={key}
                checked={dataSources[key]}
                onChange={(e) => handleDataSourceChange(key, e.target.checked)}
                style={{ fontSize: '13px' }}
              >
                {dataSourceLabels[key]}
              </Checkbox>
            ))}
          </Space>
        </div>

        {/* 自然语言查询 */}
        <div>
          <div style={{ marginBottom: 12, fontWeight: 500, fontSize: '14px', color: '#333' }}>
            数据需求描述：
          </div>
          <TextArea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="请用自然语言描述您需要的数据范围和表格内容，例如：查询2023年全年阿托伐他汀的销售额和销量，按月份统计"
            rows={5}
            style={{ fontSize: '13px' }}
          />
        </div>

        {/* 提示信息 */}
        <div style={{
          background: '#f0f7ff',
          padding: '12px',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666',
          border: '1px solid #d6e4ff'
        }}>
          <div style={{ fontWeight: 500, marginBottom: '4px', color: '#1890ff' }}>
            提示：
          </div>
          <div>• 可以同时选择多个数据源进行查询</div>
          <div>• 支持按时间、产品、地区等维度进行数据筛选</div>
          <div>• 系统会自动生成对应的数据表格</div>
        </div>
      </Space>
    </Modal>
  );
};

export default CubeSalesModal;
