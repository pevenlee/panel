import React, { useState } from 'react';
import { Card, Checkbox, Input, Button, Space, Spin, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../services/api';

const { TextArea } = Input;

const CubeSalesConfig = ({ nodeId, onConfigChange, onExecute }) => {
  const [dataSources, setDataSources] = useState({
    urbanHospital: false,
    retailPharmacy: false
  });

  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const dataSourceLabels = {
    urbanHospital: '城市核心医院 (IPM数据)',
    retailPharmacy: '实体零售药房 (Fact数据)'
  };

  const dataSourceMapping = {
    urbanHospital: 'ipm',
    retailPharmacy: 'fact'
  };

  const handleDataSourceChange = (key, checked) => {
    const newSources = { ...dataSources, [key]: checked };
    setDataSources(newSources);

    if (onConfigChange) {
      onConfigChange({
        dataSources: newSources,
        queryText
      });
    }
  };

  const handleQueryChange = (e) => {
    const text = e.target.value;
    setQueryText(text);

    if (onConfigChange) {
      onConfigChange({
        dataSources,
        queryText: text
      });
    }
  };

  const handleExecute = async () => {
    const selectedSources = Object.keys(dataSources).filter(key => dataSources[key]);

    if (selectedSources.length === 0) {
      message.warning('请至少选择一个数据源');
      return;
    }

    if (!queryText.trim()) {
      message.warning('请输入数据查询需求');
      return;
    }

    setLoading(true);

    // 映射到实际的数据表名称
    const dataTables = selectedSources.map(source => dataSourceMapping[source]);

    try {
      const response = await fetch(`${API_BASE_URL}/research/cube-sales/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          node_id: nodeId,
          data_tables: dataTables,
          query_text: queryText
        })
      });

      if (!response.ok) {
        throw new Error('执行失败');
      }

      const data = await response.json();
      setResult(data);

      if (onExecute) {
        onExecute(data);
      }

      message.success('执行成功');
    } catch (error) {
      console.error('执行错误:', error);
      message.error('执行失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      size="small"
      title="魔方销售数据库配置"
      style={{ width: '100%' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 数据源选择 */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: '12px' }}>
            选择数据源：
          </div>
          <Space direction="vertical" size="small">
            {Object.keys(dataSourceLabels).map(key => (
              <Checkbox
                key={key}
                checked={dataSources[key]}
                onChange={(e) => handleDataSourceChange(key, e.target.checked)}
              >
                {dataSourceLabels[key]}
              </Checkbox>
            ))}
          </Space>
        </div>

        {/* 自然语言查询 */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: '12px' }}>
            数据需求描述：
          </div>
          <TextArea
            value={queryText}
            onChange={handleQueryChange}
            placeholder="请用自然语言描述您需要的数据范围和表格内容，例如：查询2023年全年阿托伐他汀的销售额和销量，按月份统计"
            rows={4}
            style={{ fontSize: '12px' }}
          />
        </div>

        {/* 执行按钮 */}
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={handleExecute}
          loading={loading}
          block
        >
          执行查询
        </Button>

        {/* 结果显示 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin tip="正在处理..." />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
              正在检查历史代码并生成数据...
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 500, fontSize: '12px', marginBottom: 8 }}>
              执行结果：
            </div>
            <div style={{
              background: '#f5f5f5',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '11px',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              {result.description && (
                <div style={{ marginBottom: 8, color: '#666' }}>
                  {result.description}
                </div>
              )}
              {result.table_preview && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {result.table_preview}
                </pre>
              )}
            </div>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default CubeSalesConfig;
