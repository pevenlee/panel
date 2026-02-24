import React, { useState, useEffect } from 'react';
import { X, Database, Clock, Zap, FileText } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

const ToolDetailPanel = ({ tool, onClose, onConfirm }) => {
  const [toolDetail, setToolDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    databases: [],
    preset_question: '',
    time_range: 365,
    custom_prompt: ''
  });

  // 当 tool 变化时，重新获取工具详情并初始化表单
  useEffect(() => {
    if (tool && tool.tool_id) {
      fetchToolDetail(tool.tool_id, tool.userConfig);
    }
  }, [tool?.tool_id, tool?.id, JSON.stringify(tool?.userConfig)]);

  const fetchToolDetail = async (toolId, userConfig) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/toolbox/tool/${toolId}`);
      setToolDetail(response.data);

      // 初始化表单数据 - 优先使用已保存的配置
      const currentUserConfig = userConfig || {};
      const newFormData = {
        databases: currentUserConfig.databases || response.data.databases || [],
        preset_question: currentUserConfig.preset_question || '',
        time_range: currentUserConfig.time_range || response.data.default_time_range || 365,
        custom_prompt: currentUserConfig.custom_prompt || ''
      };

      setFormData(newFormData);

      console.log('[ToolDetailPanel] 初始化表单数据:', {
        toolId,
        userConfig: currentUserConfig,
        formData: newFormData,
        responseDatabases: response.data.databases
      });
    } catch (err) {
      console.error('获取工具详情失败:', err);
      setError(err.message || '获取工具详情失败');
      // 使用传入的 tool 数据作为回退
      if (tool) {
        setToolDetail({
          tool_id: tool.tool_id,
          tool_name: tool.tool_name || tool.tool_id,
          description: tool.description || '',
          databases: tool.databases || ['fact', 'ipmdata'],
          preset_questions: tool.preset_questions || [],
          model: tool.config?.model || 'deep',
          time_range_enabled: true,
          default_time_range: 365,
          visible_fields: {}
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    // 构建 userConfig，只包含启用的字段
    const userConfig = {
      databases: formData.databases,
      preset_question: formData.preset_question,
      custom_prompt: formData.custom_prompt
    };

    // 只有当时间范围启用时才传递 time_range
    if (toolDetail?.time_range_enabled) {
      userConfig.time_range = formData.time_range;
    }

    onConfirm({
      ...tool,
      userConfig
    });
  };

  if (!tool || loading) {
    return (
      <div style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: '400px',
        height: '100vh',
        background: 'white',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>加载中...</div>
      </div>
    );
  }

  // 如果 toolDetail 为空，显示错误信息
  if (!toolDetail) {
    return (
      <div style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: '400px',
        height: '100vh',
        background: 'white',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{ color: '#ff4d4f', marginBottom: '16px' }}>
          加载工具详情失败
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            border: '1px solid #d9d9d9',
            background: 'white',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          关闭
        </button>
      </div>
    );
  }

  const visibleFields = toolDetail?.visible_fields || {};

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      width: '400px',
      height: '100vh',
      background: 'white',
      boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 头部 */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          {toolDetail.tool_name}
        </h3>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* 内容区域 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px'
      }}>
        {/* 工具描述 - 根据中台配置显示 */}
        {visibleFields.description !== false && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              {toolDetail.description}
            </div>
          </div>
        )}

        {/* 数据库选择 - 根据中台配置显示 */}
        {visibleFields.databases !== false && toolDetail.databases && toolDetail.databases.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 600
            }}>
              <Database size={16} />
              <span>数据源</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {toolDetail.databases.map(db => (
                <label key={db} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.databases?.includes(db) || false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          databases: [...(formData.databases || []), db]
                        });
                      } else {
                        setFormData({
                          ...formData,
                          databases: (formData.databases || []).filter(d => d !== db)
                        });
                      }
                    }}
                  />
                  <span style={{ fontSize: '14px' }}>
                    {db === 'fact' ? '核心医院渠道' : db === 'ipmdata' ? '实体零售渠道' : db}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 预置问题 - 根据中台配置显示 */}
        {visibleFields.preset_questions !== false && toolDetail.preset_questions && toolDetail.preset_questions.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 600
            }}>
              <FileText size={16} />
              <span>预置问题</span>
            </div>
            <select
              value={formData.preset_question}
              onChange={(e) => setFormData({ ...formData, preset_question: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="">选择预置问题...</option>
              {toolDetail.preset_questions.map((q, idx) => (
                <option key={idx} value={q}>{q}</option>
              ))}
            </select>
          </div>
        )}

        {/* 时间范围 - 根据中台配置显示 */}
        {visibleFields.time_range !== false && toolDetail.time_range_enabled && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 600
            }}>
              <Clock size={16} />
              <span>时间范围</span>
            </div>
            <div>
              <input
                type="range"
                min="30"
                max="1095"
                step="30"
                value={formData.time_range}
                onChange={(e) => setFormData({ ...formData, time_range: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
              <div style={{ textAlign: 'center', fontSize: '14px', color: '#666', marginTop: '8px' }}>
                {formData.time_range} 天
              </div>
            </div>
          </div>
        )}

        {/* 模型选择 - 根据中台配置显示 */}
        {visibleFields.model !== false && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 600
            }}>
              <Zap size={16} />
              <span>AI模型</span>
            </div>
            <div style={{
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {toolDetail.model === 'fast' && '快速模型 (Gemini Flash)'}
              {toolDetail.model === 'deep' && '深度模型 (Gemini Pro)'}
              {toolDetail.model === 'image' && '图像模型 (Gemini Pro Vision)'}
            </div>
          </div>
        )}

        {/* 系统提示词 - 根据中台配置显示 */}
        {visibleFields.system_prompt !== false && toolDetail.system_prompt && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px'
            }}>
              系统提示词
            </div>
            <div style={{
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#666',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {toolDetail.system_prompt}
            </div>
          </div>
        )}

        {/* 自定义输入 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px'
          }}>
            自定义输入
          </div>
          <textarea
            value={formData.custom_prompt}
            onChange={(e) => setFormData({ ...formData, custom_prompt: e.target.value })}
            placeholder="输入您的查询或需求..."
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              fontSize: '14px',
              minHeight: '100px',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* 底部按钮 */}
      <div style={{
        padding: '20px',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        gap: '12px'
      }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #d9d9d9',
            background: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          取消
        </button>
        <button
          onClick={handleConfirm}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            background: '#1890ff',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          确认添加
        </button>
      </div>
    </div>
  );
};

export default ToolDetailPanel;
