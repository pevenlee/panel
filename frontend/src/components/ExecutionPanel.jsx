import React, { useState, useRef } from 'react';
import { Card, Steps, Spin, Tag, Table, Button, Collapse } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, ClockCircleOutlined, TableOutlined, FileTextOutlined, DownloadOutlined, PlayCircleOutlined, BarChartOutlined, CodeOutlined, PictureOutlined } from '@ant-design/icons';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';

const { Panel } = Collapse;

// 数据表格组件
const DataTableView = ({ data, columns, rowCount, description }) => {
  const [showAll, setShowAll] = useState(false);

  if (!data || !columns || data.length === 0) {
    return null;
  }

  // 下载CSV功能
  const handleDownloadCSV = () => {
    const csvContent = [
      columns.join(','),
      ...data.map(row => columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') ? `"${str}"` : str;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 构建表格列配置
  const tableColumns = columns.map(col => ({
    title: col,
    dataIndex: col,
    key: col,
    ellipsis: true,
    width: 120,
    render: (value) => {
      if (value === null || value === undefined) return '-';
      if (typeof value === 'number') {
        return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
      }
      return String(value);
    }
  }));

  // 显示的数据（默认前10条）
  const displayData = showAll ? data.slice(0, 100) : data.slice(0, 10);

  return (
    <div style={{ marginTop: '8px' }}>
      {/* 描述信息 */}
      {description && (
        <div style={{
          background: '#e6f7ff',
          border: '1px solid #91d5ff',
          borderRadius: '4px',
          padding: '8px 12px',
          marginBottom: '8px',
          fontSize: '11px',
          color: '#0050b3'
        }}>
          <FileTextOutlined style={{ marginRight: '6px' }} />
          {description}
        </div>
      )}

      {/* 数据统计 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <span style={{ fontSize: '11px', color: '#666' }}>
          <TableOutlined style={{ marginRight: '4px' }} />
          共 {rowCount || data.length} 条数据，{columns.length} 列
        </span>
        <div>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleDownloadCSV}
            style={{ fontSize: '11px', padding: '0 8px' }}
          >
            下载CSV
          </Button>
          {data.length > 10 && (
            <Button
              type="link"
              size="small"
              onClick={() => setShowAll(!showAll)}
              style={{ fontSize: '11px', padding: 0 }}
            >
              {showAll ? '收起' : `显示更多 (${Math.min(100, data.length)}条)`}
            </Button>
          )}
        </div>
      </div>

      {/* 数据表格 */}
      <div style={{
        border: '1px solid #f0f0f0',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <Table
          columns={tableColumns}
          dataSource={displayData.map((row, idx) => ({ ...row, key: idx }))}
          size="small"
          pagination={false}
          scroll={{ x: 'max-content', y: 200 }}
          style={{ fontSize: '10px' }}
        />
      </div>
    </div>
  );
};

// Markdown 内容显示组件
const MarkdownContentView = ({ markdownContent, description }) => {
  if (!markdownContent) {
    return null;
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {/* 描述信息 */}
      {description && (
        <div style={{
          background: '#e6f7ff',
          border: '1px solid #91d5ff',
          borderRadius: '4px',
          padding: '8px 12px',
          marginBottom: '8px',
          fontSize: '11px',
          color: '#0050b3'
        }}>
          <FileTextOutlined style={{ marginRight: '6px' }} />
          {description}
        </div>
      )}

      {/* Markdown 内容 */}
      <div style={{
        border: '1px solid #f0f0f0',
        borderRadius: '4px',
        padding: '12px',
        background: '#fff',
        maxHeight: '500px',
        overflowY: 'auto',
        fontSize: '13px',
        lineHeight: '1.6'
      }}>
        <ReactMarkdown
          components={{
            h1: ({ node, ...props }) => <h1 style={{ fontSize: '20px', marginTop: '16px', marginBottom: '12px', borderBottom: '2px solid #f0f0f0', paddingBottom: '8px' }} {...props} />,
            h2: ({ node, ...props }) => <h2 style={{ fontSize: '18px', marginTop: '14px', marginBottom: '10px', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px' }} {...props} />,
            h3: ({ node, ...props }) => <h3 style={{ fontSize: '16px', marginTop: '12px', marginBottom: '8px' }} {...props} />,
            p: ({ node, ...props }) => <p style={{ marginBottom: '8px' }} {...props} />,
            ul: ({ node, ...props }) => <ul style={{ marginLeft: '20px', marginBottom: '8px' }} {...props} />,
            ol: ({ node, ...props }) => <ol style={{ marginLeft: '20px', marginBottom: '8px' }} {...props} />,
            li: ({ node, ...props }) => <li style={{ marginBottom: '4px' }} {...props} />,
            table: ({ node, ...props }) => <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '12px' }} {...props} />,
            thead: ({ node, ...props }) => <thead style={{ background: '#fafafa' }} {...props} />,
            th: ({ node, ...props }) => <th style={{ border: '1px solid #f0f0f0', padding: '8px', textAlign: 'left', fontWeight: 600 }} {...props} />,
            td: ({ node, ...props }) => <td style={{ border: '1px solid #f0f0f0', padding: '8px' }} {...props} />,
            code: ({ node, inline, ...props }) => inline
              ? <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px', fontSize: '12px' }} {...props} />
              : <code style={{ display: 'block', background: '#f5f5f5', padding: '12px', borderRadius: '4px', fontSize: '12px', overflowX: 'auto' }} {...props} />
          }}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

// 图表配置显示组件
const ChartConfigView = ({ chartConfig, description, data }) => {
  const chartRef = useRef(null);

  // 下载图表为PNG
  const handleDownloadChart = async () => {
    if (!chartRef.current) return;
    try {
      const svgElement = chartRef.current.querySelector('svg');
      if (!svgElement) return;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      canvas.width = svgElement.clientWidth * 2;
      canvas.height = svgElement.clientHeight * 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const link = document.createElement('a');
        link.download = `chart_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (e) {
      console.error('下载图表失败:', e);
    }
  };

  // 下载图表数据为CSV
  const handleDownloadData = () => {
    if (!data || data.length === 0) return;
    const columns = Object.keys(data[0]);
    const csvContent = [
      columns.join(','),
      ...data.map(row => columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') ? `"${str}"` : str;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chart_data_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!chartConfig) {
    return null;
  }

  // 颜色配置
  const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];

  // 渲染实际图表
  const renderChart = () => {

    if (!data || data.length === 0) {
      console.log('[renderChart] 数据为空或长度为0，显示暂无数据');
      return (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#999',
          background: '#fafafa',
          borderRadius: '4px'
        }}>
          暂无数据
        </div>
      );
    }

    // 调试日志
    console.log('[图表渲染] 接收到的数据:', data);
    console.log('[图表渲染] 数据类型:', typeof data);
    console.log('[图表渲染] 是否为数组:', Array.isArray(data));
    console.log('[图表渲染] 数据条数:', data.length);
    console.log('[图表渲染] 第一条数据:', data[0]);
    console.log('[图表渲染] 数据的所有键:', Object.keys(data[0] || {}));
    console.log('[图表渲染] 完整数据对象:', JSON.stringify(data.slice(0, 3), null, 2));
    console.log('[图表渲染] 图表配置:', chartConfig);

    // 兼容多种字段名格式
    const chartType = (
      chartConfig.chart_type ||
      chartConfig.chartType ||
      chartConfig.type ||
      'bar'
    )?.toLowerCase();

    const xAxis =
      chartConfig.x_axis ||
      chartConfig.xAxis ||
      chartConfig.x ||
      Object.keys(data[0] || {})[0]; // 默认使用第一个字段

    const yAxis =
      chartConfig.y_axis ||
      chartConfig.yAxis ||
      chartConfig.y ||
      Object.keys(data[0] || {})[1]; // 默认使用第二个字段

    console.log('[图表渲染] 图表类型:', chartType);
    console.log('[图表渲染] X轴字段:', xAxis);
    console.log('[图表渲染] Y轴字段:', yAxis);

    // 检查Y轴字段是否为数值类型
    const firstValue = data[0]?.[yAxis];
    const isNumericY = typeof firstValue === 'number' || !isNaN(parseFloat(firstValue));

    console.log('[图表渲染] Y轴第一个值:', firstValue);
    console.log('[图表渲染] Y轴是否为数值:', isNumericY);

    // 如果Y轴不是数值，进行数据聚合（统计每个X轴值的数量）
    let chartData = data;
    let actualYAxis = yAxis;

    if (!isNumericY && (chartType === 'bar' || chartType === 'line')) {
      console.log('[图表渲染] Y轴非数值，进行数据聚合');

      // 按X轴分组统计数量
      const grouped = {};
      data.forEach(item => {
        const key = item[xAxis];
        if (key) {
          grouped[key] = (grouped[key] || 0) + 1;
        }
      });

      // 转换为图表数据格式
      chartData = Object.entries(grouped).map(([key, count]) => ({
        [xAxis]: key,
        '数量': count
      }));

      actualYAxis = '数量';

      console.log('[图表渲染] 聚合后的数据:', chartData);
      console.log('[图表渲染] 新的Y轴字段:', actualYAxis);
    }

    // 柱状图
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxis} style={{ fontSize: '11px' }} />
            <YAxis style={{ fontSize: '11px' }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey={actualYAxis} fill="#1890ff" />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // 折线图
    if (chartType === 'line' || chartType === 'multiline') {
      const yAxisFields = Array.isArray(actualYAxis) ? actualYAxis : [actualYAxis];
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxis} style={{ fontSize: '11px' }} />
            <YAxis style={{ fontSize: '11px' }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {yAxisFields.map((field, idx) => (
              <Line
                key={field}
                type="monotone"
                dataKey={field}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // 饼图
    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey={actualYAxis}
              nameKey={xAxis}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    // 默认：柱状图
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxis} style={{ fontSize: '11px' }} />
          <YAxis style={{ fontSize: '11px' }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Bar dataKey={actualYAxis} fill="#1890ff" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div style={{ marginTop: '8px' }}>
      {/* 描述信息 */}
      {description && (
        <div style={{
          background: '#f0f5ff',
          border: '1px solid #adc6ff',
          borderRadius: '4px',
          padding: '8px 12px',
          marginBottom: '12px',
          fontSize: '11px',
          color: '#1d39c4'
        }}>
          <BarChartOutlined style={{ marginRight: '6px' }} />
          {description}
        </div>
      )}

      {/* 图表渲染区域 */}
      <div style={{
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: '4px',
        padding: '16px',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          {chartConfig.title ? (
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#262626' }}>
              {chartConfig.title}
            </div>
          ) : <div />}
          <div>
            <Button type="link" size="small" icon={<PictureOutlined />} onClick={handleDownloadChart} style={{ fontSize: '11px' }}>
              下载图片
            </Button>
            <Button type="link" size="small" icon={<DownloadOutlined />} onClick={handleDownloadData} style={{ fontSize: '11px' }}>
              下载数据
            </Button>
          </div>
        </div>
        <div ref={chartRef}>
          {renderChart()}
        </div>
      </div>

      {/* 图表配置信息 */}
      <div style={{
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: '4px',
        padding: '12px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#1890ff' }}>
          <BarChartOutlined style={{ marginRight: '6px' }} />
          图表配置
        </div>

        <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#666', marginRight: '8px' }}>图表类型:</span>
            <Tag color="blue">{chartConfig.chart_type || '未指定'}</Tag>
          </div>

          {chartConfig.title && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#666', marginRight: '8px' }}>标题:</span>
              <span style={{ fontWeight: 500 }}>{chartConfig.title}</span>
            </div>
          )}

          {chartConfig.x_axis && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#666', marginRight: '8px' }}>X轴:</span>
              <Tag>{chartConfig.x_axis}</Tag>
            </div>
          )}

          {chartConfig.y_axis && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#666', marginRight: '8px' }}>Y轴:</span>
              <Tag>{Array.isArray(chartConfig.y_axis) ? chartConfig.y_axis.join(', ') : chartConfig.y_axis}</Tag>
            </div>
          )}

          {chartConfig.recommendation_reason && (
            <div style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #f0f0f0',
              color: '#666',
              fontStyle: 'italic'
            }}>
              推荐理由: {chartConfig.recommendation_reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ExecutionPanel = ({ execution }) => {
  if (!execution) {
    return (
      <div style={{ color: '#999', textAlign: 'center', marginTop: '40px', fontSize: '12px' }}>
        <ClockCircleOutlined style={{ fontSize: '24px', marginBottom: '8px', display: 'block' }} />
        暂无执行任务
        <div style={{ marginTop: '8px', fontSize: '11px' }}>
          点击节点上的 <PlayCircleOutlined style={{ color: '#52c41a' }} /> 按钮执行单个节点
        </div>
      </div>
    );
  }

  const { totalSteps, currentStep, steps, status } = execution;

  return (
    <div style={{ padding: '16px' }}>
      {/* 总体进度 */}
      <Card size="small" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          执行进度
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          总共 {totalSteps} 个环节，当前第 {currentStep} 个环节
        </div>
        <div style={{ marginTop: '8px' }}>
          {status === 'running' && (
            <Tag icon={<LoadingOutlined />} color="processing">执行中</Tag>
          )}
          {status === 'completed' && (
            <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>
          )}
          {status === 'error' && (
            <Tag color="error">执行失败</Tag>
          )}
        </div>
      </Card>

      {/* 步骤详情 */}
      <Steps
        style={{ marginTop: '8px' }}
        size="small"
        current={currentStep - 1}
        items={steps.map((step, index) => ({
          title: (
            <span style={{ fontSize: '12px', fontWeight: 500 }}>
              {step.name}
            </span>
          ),
          subTitle: step.status === 'completed' ? (
            <Tag color="success" style={{ fontSize: '10px', marginLeft: '8px' }}>完成</Tag>
          ) : step.status === 'running' ? (
            <Tag color="processing" style={{ fontSize: '10px', marginLeft: '8px' }}>执行中</Tag>
          ) : step.status === 'error' ? (
            <Tag color="error" style={{ fontSize: '10px', marginLeft: '8px' }}>失败</Tag>
          ) : null,
          status: step.status === 'completed' ? 'finish' :
            step.status === 'running' ? 'process' :
              step.status === 'error' ? 'error' : 'wait',
          icon: step.status === 'running' ? <LoadingOutlined /> :
            step.status === 'pending' ? <ClockCircleOutlined /> : undefined
        }))}
      />

      {/* 步骤结果详情 */}
      {steps.map((step, index) => (
        <div key={step.id || index} style={{ marginTop: '12px' }}>
          {/* 执行中状态 */}
          {step.status === 'running' && (
            <Card size="small" style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
              <div style={{ color: '#1890ff', fontSize: '12px' }}>
                <Spin size="small" style={{ marginRight: '8px' }} />
                正在执行: {step.name}
              </div>
            </Card>
          )}

          {/* 错误状态 */}
          {step.status === 'error' && step.error && (
            <Card size="small" style={{ background: '#fff2f0', border: '1px solid #ffccc7' }}>
              <div style={{ color: '#ff4d4f', fontSize: '11px' }}>
                <strong>{step.name}</strong> 执行失败: {step.error}
              </div>
            </Card>
          )}

          {/* 完成状态 - 有图表配置 */}
          {step.status === 'completed' && step.chart_config && (
            <Card
              size="small"
              title={<span style={{ fontSize: '12px' }}>{step.name} - 图表</span>}
              style={{ marginBottom: '8px' }}
            >
              <ChartConfigView
                chartConfig={step.chart_config}
                description={step.description}
                data={step.data}
              />
            </Card>
          )}

          {/* 完成状态 - 有 Markdown 内容（财报分析等） */}
          {step.status === 'completed' && step.markdown_content && (
            <Card
              size="small"
              title={<span style={{ fontSize: '12px' }}>{step.name} - 分析报告</span>}
              style={{ marginBottom: '8px' }}
            >
              <MarkdownContentView
                markdownContent={step.markdown_content}
                description={step.description}
              />
            </Card>
          )}

          {/* 完成状态 - 有数据表格 */}
          {step.status === 'completed' && step.data && step.columns && !step.chart_config && !step.markdown_content && (
            <Card
              size="small"
              title={<span style={{ fontSize: '12px' }}>{step.name} - 查询结果</span>}
              style={{ marginBottom: '8px' }}
            >
              <DataTableView
                data={step.data}
                columns={step.columns}
                rowCount={step.row_count}
                description={step.description}
              />
            </Card>
          )}

          {/* 完成状态 - 无数据表格，只有输出文本 */}
          {step.status === 'completed' && !step.data && !step.markdown_content && step.output && (
            <Card
              size="small"
              title={<span style={{ fontSize: '12px' }}>{step.name}</span>}
              style={{ marginBottom: '8px' }}
            >
              <div style={{
                background: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                maxHeight: '120px',
                overflow: 'auto'
              }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '10px' }}>
                  {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                </pre>
              </div>
            </Card>
          )}

          {/* 完成状态 - 显示生成的代码 (可折叠) */}
          {step.status === 'completed' && step.generated_code && (
            <div style={{ marginBottom: '8px' }}>
              <Collapse
                ghost
                size="small"
                expandIconPosition="end"
                items={[{
                  key: 'code',
                  label: (
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      <CodeOutlined style={{ marginRight: '6px' }} />
                      查看生成代码
                    </span>
                  ),
                  children: (
                    <div style={{
                      background: '#282c34',
                      padding: '12px',
                      borderRadius: '4px',
                      overflow: 'auto',
                      maxHeight: '300px'
                    }}>
                      <pre style={{
                        margin: 0,
                        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                        fontSize: '11px',
                        color: '#abb2bf',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {step.generated_code}
                      </pre>
                    </div>
                  )
                }]}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ExecutionPanel;
