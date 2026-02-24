import React, { useState, useEffect } from 'react';
import { Settings, Play, BarChart3, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

const SkillsAdmin = () => {
  const [skills, setSkills] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/skills`);
      setSkills(response.data.skills);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load skills:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Skills 管理中台</h1>
          <p className="text-gray-600 mt-2">可视化管理和配置所有 Skills</p>
        </div>

        <SkillsList
          skills={skills}
          onSelectSkill={setSelectedSkill}
          onRefresh={loadSkills}
        />

        {selectedSkill && (
          <SkillDetail
            skillName={selectedSkill}
            onClose={() => setSelectedSkill(null)}
          />
        )}
      </div>
    </div>
  );
};

// Skills 列表组件
const SkillsList = ({ skills, onSelectSkill, onRefresh }) => {
  const [filter, setFilter] = useState('');

  const filteredSkills = Object.entries(skills).filter(([name, info]) =>
    name.toLowerCase().includes(filter.toLowerCase()) ||
    info.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <input
          type="text"
          placeholder="搜索 Skills..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="divide-y">
        {filteredSkills.map(([name, info]) => (
          <SkillCard
            key={name}
            name={name}
            info={info}
            onSelect={() => onSelectSkill(name)}
          />
        ))}
      </div>
    </div>
  );
};

// Skills 卡片组件
const SkillCard = ({ name, info, onSelect }) => {
  const [toggling, setToggling] = useState(false);
  const [enabled, setEnabled] = useState(info.enabled !== false);

  const handleToggle = async (e) => {
    e.stopPropagation();
    setToggling(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/skills/${name}/toggle`);
      setEnabled(response.data.enabled);
    } catch (error) {
      console.error('Failed to toggle skill:', error);
    }
    setToggling(false);
  };

  return (
    <div
      className="p-4 hover:bg-gray-50 cursor-pointer transition"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
            {enabled ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <p className="text-gray-600 mt-1">{info.description}</p>
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>版本: {info.version}</span>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`px-4 py-2 rounded-lg transition ${
            enabled
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {toggling ? '...' : enabled ? '已启用' : '已禁用'}
        </button>
      </div>
    </div>
  );
};

// Skills 详情组件
const SkillDetail = ({ skillName, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('config');

  useEffect(() => {
    loadDetail();
  }, [skillName]);

  const loadDetail = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/skills/${skillName}`);
      setDetail(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load skill detail:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">{skillName}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="border-b">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('config')}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === 'config'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600'
              }`}
            >
              配置
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === 'metrics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600'
              }`}
            >
              监控
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === 'test'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600'
              }`}
            >
              测试
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'config' && <ConfigTab skillName={skillName} detail={detail} />}
          {activeTab === 'metrics' && <MetricsTab skillName={skillName} stats={detail.stats} />}
          {activeTab === 'test' && <TestTab skillName={skillName} />}
        </div>
      </div>
    </div>
  );
};

// 配置标签页
const ConfigTab = ({ skillName, detail }) => {
  const [config, setConfig] = useState(detail.config || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/admin/skills/${skillName}/config`, { config });
      alert('配置已保存');
    } catch (error) {
      alert('保存失败: ' + error.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">基本信息</h3>
        <div className="space-y-2 text-sm">
          <div><span className="text-gray-600">名称:</span> {detail.info.name}</div>
          <div><span className="text-gray-600">描述:</span> {detail.info.description}</div>
          <div><span className="text-gray-600">版本:</span> {detail.info.version}</div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-4">配置参数</h3>
        <div className="space-y-3">
          {Object.entries(config).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {key}
              </label>
              <input
                type="text"
                value={JSON.stringify(value)}
                onChange={(e) => {
                  try {
                    const newValue = JSON.parse(e.target.value);
                    setConfig({ ...config, [key]: newValue });
                  } catch {}
                }}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存配置'}
      </button>
    </div>
  );
};

// 监控标签页
const MetricsTab = ({ skillName, stats }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">总执行次数</div>
          <div className="text-2xl font-bold text-blue-600">{stats.total_executions}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">成功率</div>
          <div className="text-2xl font-bold text-green-600">{stats.success_rate}%</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">成功次数</div>
          <div className="text-2xl font-bold text-purple-600">{stats.success_count}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">失败次数</div>
          <div className="text-2xl font-bold text-red-600">{stats.failure_count}</div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="text-sm text-gray-600">平均执行时间</div>
        <div className="text-xl font-bold">{stats.avg_duration_ms} ms</div>
      </div>

      <div className="bg-white border rounded-lg">
        <div className="p-4 border-b">
          <h3 className="font-semibold">最近执行记录</h3>
        </div>
        <div className="divide-y max-h-64 overflow-y-auto">
          {stats.recent_executions.map((record, idx) => (
            <div key={idx} className="p-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {record.success ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm">{new Date(record.timestamp).toLocaleString()}</span>
              </div>
              <span className="text-sm text-gray-600">{record.duration_ms.toFixed(2)} ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 测试标签页
const TestTab = ({ skillName }) => {
  const [params, setParams] = useState('{}');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const parsedParams = JSON.parse(params);
      const response = await axios.post(
        `${API_BASE_URL}/admin/skills/${skillName}/test`,
        { params: parsedParams }
      );
      setResult(response.data);
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          测试参数 (JSON)
        </label>
        <textarea
          value={params}
          onChange={(e) => setParams(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
          placeholder='{"query_text": "测试查询", ...}'
        />
      </div>

      <button
        onClick={handleTest}
        disabled={testing}
        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" />
        {testing ? '执行中...' : '执行测试'}
      </button>

      {result && (
        <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="font-semibold">
              {result.success ? '执行成功' : '执行失败'}
            </span>
            {result.duration_ms && (
              <span className="text-sm text-gray-600">({result.duration_ms} ms)</span>
            )}
          </div>
          <pre className="text-sm overflow-auto max-h-64 bg-white p-3 rounded">
            {JSON.stringify(result.success ? result.data : result.error, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default SkillsAdmin;
