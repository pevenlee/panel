import React, { useState, useEffect } from 'react';
import { Settings, Save, X, Plus, Trash2, Database, BarChart3, Search, FileText } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

// 字段标签组件，带可见性切换按钮
const FieldLabel = ({ label, fieldKey, visible, onToggle }) => {
  return (
    <div className="flex items-center justify-between mb-1">
      <label className="block text-sm font-medium">{label}</label>
      <button
        onClick={onToggle}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          visible
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
        title={visible ? '在画布中显示' : '在画布中隐藏'}
      >
        {visible ? '显示' : '隐藏'}
      </button>
    </div>
  );
};

const ToolboxManagement = ({ onClose, initialTool = null }) => {
  const [tools, setTools] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [editingTool, setEditingTool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibleFields, setVisibleFields] = useState({});

  // 数据库选项
  const databaseOptions = [
    { value: 'fact', label: '核心医院渠道' },
    { value: 'ipmdata', label: '实体零售渠道' }
  ];

  // 输出形式选项
  const outputTypeOptions = [
    { value: 'markdown', label: 'Markdown文档' },
    { value: 'html', label: 'HTML网页' },
    { value: 'chart', label: '图表' },
    { value: 'table', label: '表格' },
    { value: 'insight', label: '洞察' },
    { value: 'image', label: '图片' }
  ];

  useEffect(() => {
    loadTools();
  }, []);

  // 如果传入了初始工具，自动选中并加载详情
  useEffect(() => {
    if (initialTool && tools.length > 0) {
      handleSelectTool(initialTool);
    }
  }, [initialTool, tools]);

  const loadTools = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/research/tools`);
      setTools(response.data.tools || []);
    } catch (error) {
      console.error('加载工具失败:', error);
      setTools([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTool = async (tool) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/toolbox/tool/${tool.tool_id}`);
      setSelectedTool(response.data);
      setEditingTool({ ...response.data });

      // 初始化可见性设置（默认所有字段都可见）
      const defaultVisibility = {
        tool_name: response.data.visible_fields?.tool_name ?? true,
        description: response.data.visible_fields?.description ?? true,
        databases: response.data.visible_fields?.databases ?? true,
        crawl_urls: response.data.visible_fields?.crawl_urls ?? true,
        preset_questions: response.data.visible_fields?.preset_questions ?? true,
        model: response.data.visible_fields?.model ?? true,
        time_range: response.data.visible_fields?.time_range ?? true,
        output_types: response.data.visible_fields?.output_types ?? true,
        system_prompt: response.data.visible_fields?.system_prompt ?? true,
      };
      setVisibleFields(defaultVisibility);
    } catch (error) {
      console.error('加载工具详情失败:', error);
    }
  };

  const handleSaveTool = async () => {
    if (!editingTool) return;

    try {
      setSaving(true);

      // 将可见性设置添加到工具配置中
      const toolWithVisibility = {
        ...editingTool,
        visible_fields: visibleFields
      };

      await axios.put(`${API_BASE_URL}/toolbox/tool/${editingTool.tool_id}`, toolWithVisibility);

      setTools(tools.map(t =>
        t.tool_id === editingTool.tool_id ? toolWithVisibility : t
      ));
      setSelectedTool(toolWithVisibility);

      alert('保存成功！');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTool = async () => {
    const newToolId = `custom_tool_${Date.now()}`;
    const newTool = {
      tool_id: newToolId,
      tool_name: '新工具',
      category: 'data_extraction',
      description: '请编辑工具描述',
      icon: '',
      input_schema: {},
      output_schema: {},
      config: {},
      data_source_type: 'database',
      databases: [],
      crawl_urls: [],
      preset_questions: [],
      model: 'fast',
      time_range_enabled: false,
      default_time_range: 365,
      output_types: ['table'],
      system_prompt: ''
    };

    try {
      await axios.post(`${API_BASE_URL}/toolbox/tool`, newTool);
      await loadTools();
      handleSelectTool(newTool);
      alert('工具创建成功！');
    } catch (error) {
      console.error('创建失败:', error);
      alert('创建失败，请重试');
    }
  };

  // 分类配置
  const categoryOptions = [
    { value: 'data_extraction', label: '数据获取', Icon: Database },
    { value: 'chart_creation', label: '图表制作', Icon: BarChart3 },
    { value: 'product_research', label: '产品调研', Icon: Search },
    { value: 'report_creation', label: '报告制作', Icon: FileText }
  ];

  // 按分类分组工具
  const groupedTools = categoryOptions.reduce((acc, category) => {
    acc[category.value] = tools.filter(t => t.category === category.value);
    return acc;
  }, {});

  const handleDeleteTool = async (toolId) => {
    if (!confirm('确定要删除这个工具吗？')) return;

    try {
      await axios.delete(`${API_BASE_URL}/toolbox/tool/${toolId}`);
      await loadTools();
      setSelectedTool(null);
      setEditingTool(null);
      alert('工具删除成功！');
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95%] h-[95%] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold">工具箱管理</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 主体内容 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧工具列表 */}
          <div className="w-1/4 border-r overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">工具列表</h3>
              <button
                onClick={handleCreateTool}
                className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="新建工具"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {loading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : (
              <div className="space-y-4">
                {categoryOptions.map(category => {
                  const IconComponent = category.Icon;
                  return (
                  <div key={category.value}>
                    <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-gray-100 rounded-lg">
                      <IconComponent className="w-4 h-4 text-gray-600" />
                      <span className="font-semibold text-sm">{category.label}</span>
                      <span className="ml-auto text-xs text-gray-500">
                        ({groupedTools[category.value]?.length || 0})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {groupedTools[category.value]?.map(tool => (
                        <div
                          key={tool.tool_id}
                          className={`p-3 rounded-lg transition-colors ${
                            selectedTool?.tool_id === tool.tool_id
                              ? 'bg-blue-50 border-2 border-blue-500'
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => handleSelectTool(tool)}
                            >
                              <div className="font-medium text-sm">{tool.tool_name}</div>
                              <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                                {tool.description}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTool(tool.tool_id);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="删除工具"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!groupedTools[category.value] || groupedTools[category.value].length === 0) && (
                        <div className="text-xs text-gray-400 text-center py-2">暂无工具</div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 右侧编辑区域 - 第1部分 */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedTool ? (
              <div className="text-center py-20 text-gray-400">
                请从左侧选择一个工具进行编辑
              </div>
            ) : (
              <div className="space-y-6">
                {/* 基本信息 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">基本信息</h3>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel
                        label="工具名称"
                        fieldKey="tool_name"
                        visible={visibleFields.tool_name}
                        onToggle={() => setVisibleFields({...visibleFields, tool_name: !visibleFields.tool_name})}
                      />
                      <input
                        type="text"
                        value={editingTool?.tool_name || ''}
                        onChange={(e) => setEditingTool({...editingTool, tool_name: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">工具分类</label>
                      <select
                        value={editingTool?.category || 'data_extraction'}
                        onChange={(e) => setEditingTool({...editingTool, category: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {categoryOptions.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel
                        label="描述"
                        fieldKey="description"
                        visible={visibleFields.description}
                        onToggle={() => setVisibleFields({...visibleFields, description: !visibleFields.description})}
                      />
                      <textarea
                        value={editingTool?.description || ''}
                        onChange={(e) => setEditingTool({...editingTool, description: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 数据来源 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">数据来源</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">数据来源类型</label>
                      <select
                        value={editingTool?.data_source_type || 'database'}
                        onChange={(e) => setEditingTool({...editingTool, data_source_type: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="database">数据库</option>
                        <option value="web_crawl">网络爬取</option>
                        <option value="both">数据库 + 网络爬取</option>
                      </select>
                    </div>

                    {(editingTool?.data_source_type === 'database' || editingTool?.data_source_type === 'both') && (
                      <div>
                        <FieldLabel
                          label="选择数据库"
                          fieldKey="databases"
                          visible={visibleFields.databases}
                          onToggle={() => setVisibleFields({...visibleFields, databases: !visibleFields.databases})}
                        />
                        <div className="space-y-2">
                          {databaseOptions.map(db => (
                            <label key={db.value} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={(editingTool?.databases || []).includes(db.value)}
                                onChange={(e) => {
                                  const databases = editingTool?.databases || [];
                                  if (e.target.checked) {
                                    setEditingTool({...editingTool, databases: [...databases, db.value]});
                                  } else {
                                    setEditingTool({...editingTool, databases: databases.filter(d => d !== db.value)});
                                  }
                                }}
                                className="rounded"
                              />
                              <span>{db.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {(editingTool?.data_source_type === 'web_crawl' || editingTool?.data_source_type === 'both') && (
                      <div>
                        <FieldLabel
                          label="爬取URL列表"
                          fieldKey="crawl_urls"
                          visible={visibleFields.crawl_urls}
                          onToggle={() => setVisibleFields({...visibleFields, crawl_urls: !visibleFields.crawl_urls})}
                        />
                        <div className="space-y-2">
                          {(editingTool?.crawl_urls || []).map((url, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={url}
                                onChange={(e) => {
                                  const urls = [...(editingTool?.crawl_urls || [])];
                                  urls[index] = e.target.value;
                                  setEditingTool({...editingTool, crawl_urls: urls});
                                }}
                                placeholder="输入URL"
                                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => {
                                  const urls = (editingTool?.crawl_urls || []).filter((_, i) => i !== index);
                                  setEditingTool({...editingTool, crawl_urls: urls});
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const urls = editingTool?.crawl_urls || [];
                              setEditingTool({...editingTool, crawl_urls: [...urls, '']});
                            }}
                            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            添加URL
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 预置问题 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">预置问题</h3>
                  <FieldLabel
                    label="预置问题列表"
                    fieldKey="preset_questions"
                    visible={visibleFields.preset_questions}
                    onToggle={() => setVisibleFields({...visibleFields, preset_questions: !visibleFields.preset_questions})}
                  />
                  <div className="space-y-2">
                    {(editingTool?.preset_questions || []).map((question, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={question}
                          onChange={(e) => {
                            const questions = [...(editingTool?.preset_questions || [])];
                            questions[index] = e.target.value;
                            setEditingTool({...editingTool, preset_questions: questions});
                          }}
                          placeholder={`预置问题 ${index + 1}`}
                          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => {
                            const questions = (editingTool?.preset_questions || []).filter((_, i) => i !== index);
                            setEditingTool({...editingTool, preset_questions: questions});
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const questions = editingTool?.preset_questions || [];
                        setEditingTool({...editingTool, preset_questions: [...questions, '']});
                      }}
                      className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      添加问题
                    </button>
                  </div>
                </div>

                {/* 调用模型 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">调用模型</h3>
                  <div>
                    <FieldLabel
                      label="选择模型"
                      fieldKey="model"
                      visible={visibleFields.model}
                      onToggle={() => setVisibleFields({...visibleFields, model: !visibleFields.model})}
                    />
                    <select
                      value={editingTool?.model || 'deep'}
                      onChange={(e) => setEditingTool({...editingTool, model: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="fast">Fast - 快速模型</option>
                      <option value="deep">Deep - 深度模型</option>
                      <option value="image">Image - 图像模型</option>
                    </select>
                  </div>
                </div>

                {/* 时间范围 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">时间范围</h3>
                  <FieldLabel
                    label="时间范围配置"
                    fieldKey="time_range"
                    visible={visibleFields.time_range}
                    onToggle={() => setVisibleFields({...visibleFields, time_range: !visibleFields.time_range})}
                  />
                  <div className="space-y-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editingTool?.time_range_enabled || false}
                        onChange={(e) => setEditingTool({...editingTool, time_range_enabled: e.target.checked})}
                        className="rounded"
                      />
                      <span>启用时间范围限定</span>
                    </label>

                    {editingTool?.time_range_enabled && (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          默认时间范围（天数）: {editingTool?.default_time_range || 365}
                        </label>
                        <input
                          type="range"
                          min="30"
                          max="1095"
                          step="30"
                          value={editingTool?.default_time_range || 365}
                          onChange={(e) => setEditingTool({...editingTool, default_time_range: parseInt(e.target.value)})}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>30天</span>
                          <span>1年</span>
                          <span>3年</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 输出形式 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">输出形式</h3>
                  <FieldLabel
                    label="输出形式配置"
                    fieldKey="output_types"
                    visible={visibleFields.output_types}
                    onToggle={() => setVisibleFields({...visibleFields, output_types: !visibleFields.output_types})}
                  />
                  <div className="space-y-2">
                    {outputTypeOptions.map(type => (
                      <label key={type.value} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(editingTool?.output_types || []).includes(type.value)}
                          onChange={(e) => {
                            const types = editingTool?.output_types || [];
                            if (e.target.checked) {
                              setEditingTool({...editingTool, output_types: [...types, type.value]});
                            } else {
                              setEditingTool({...editingTool, output_types: types.filter(t => t !== type.value)});
                            }
                          }}
                          className="rounded"
                        />
                        <span>{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 系统提示词 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">系统提示词</h3>
                  <div>
                    <FieldLabel
                      label="工具调用时使用的系统提示词"
                      fieldKey="system_prompt"
                      visible={visibleFields.system_prompt}
                      onToggle={() => setVisibleFields({...visibleFields, system_prompt: !visibleFields.system_prompt})}
                    />
                    <textarea
                      value={editingTool?.system_prompt || ''}
                      onChange={(e) => setEditingTool({...editingTool, system_prompt: e.target.value})}
                      rows={6}
                      placeholder="输入系统提示词，用于指导AI如何使用这个工具..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                </div>

                {/* 保存按钮 */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    onClick={() => setEditingTool({...selectedTool})}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    重置
                  </button>
                  <button
                    onClick={handleSaveTool}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存更改'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolboxManagement;
