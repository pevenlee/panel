import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Upload, CheckCircle, XCircle, RefreshCw,
  Star, ThumbsUp, ThumbsDown, MessageSquare, FileText,
  ChevronDown, ChevronUp, Copy, Download, Trash2,
  Database, Globe, Clock, Settings
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

// 数据库选项
const DATABASE_OPTIONS = [
  { value: 'fact', label: '核心医院渠道' },
  { value: 'ipmdata', label: '实体零售渠道' }
];

// 模型选项
const MODEL_OPTIONS = [
  { value: 'fast', label: '快速模型 (Flash)', desc: '响应快，适合简单任务' },
  { value: 'deep', label: '深度模型 (Pro)', desc: '推理强，适合复杂分析' },
  { value: 'image', label: '图像模型', desc: '支持图片生成' }
];

const ToolTester = () => {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState(null);
  const [testHistory, setTestHistory] = useState([]);

  useEffect(() => {
    loadTools();
    loadTestHistory();
  }, []);

  const loadTools = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/research/tools`);
      setTools(response.data.tools || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load tools:', error);
      setLoading(false);
    }
  };

  const loadTestHistory = () => {
    const saved = localStorage.getItem('tool_test_history');
    if (saved) {
      setTestHistory(JSON.parse(saved));
    }
  };

  const saveTestResult = (result) => {
    const newHistory = [result, ...testHistory].slice(0, 50);
    setTestHistory(newHistory);
    localStorage.setItem('tool_test_history', JSON.stringify(newHistory));
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
          <h1 className="text-3xl font-bold text-gray-900">工具测试平台</h1>
          <p className="text-gray-600 mt-2">测试每个工具的输入输出，评价工具效果</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ToolsList
              tools={tools}
              selectedTool={selectedTool}
              onSelectTool={setSelectedTool}
              onRefresh={loadTools}
            />
          </div>

          <div className="lg:col-span-2">
            {selectedTool ? (
              <ToolTestPanel
                tool={selectedTool}
                onSaveResult={saveTestResult}
              />
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>请从左侧选择一个工具开始测试</p>
              </div>
            )}
          </div>
        </div>

        {testHistory.length > 0 && (
          <div className="mt-8">
            <TestHistoryPanel
              history={testHistory}
              onClear={() => {
                setTestHistory([]);
                localStorage.removeItem('tool_test_history');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// 测试历史面板组件
const TestHistoryPanel = ({ history, onClear }) => {
  const [expanded, setExpanded] = useState(false);
  const displayHistory = expanded ? history : history.slice(0, 5);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">测试历史</h3>
        <div className="flex gap-2">
          <button onClick={() => {
            const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `test_history_${Date.now()}.json`;
            a.click();
          }} className="text-sm text-gray-600 hover:text-blue-500">
            <Download className="w-4 h-4 inline mr-1" />导出
          </button>
          <button onClick={onClear} className="text-sm text-red-500">
            <Trash2 className="w-4 h-4 inline mr-1" />清空
          </button>
        </div>
      </div>
      <div className="divide-y">
        {displayHistory.map(r => (
          <div key={r.id} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {r.success ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
              <span className="text-sm font-medium">{r.tool_name}</span>
              <span className="text-xs text-gray-500">{new Date(r.timestamp).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              {r.rating && [...Array(r.rating)].map((_, i) => <Star key={i} className="w-3 h-3 text-yellow-500 fill-current" />)}
              <span className="text-xs text-gray-500">{r.duration_ms}ms</span>
            </div>
          </div>
        ))}
      </div>
      {history.length > 5 && (
        <div className="p-3 text-center border-t">
          <button onClick={() => setExpanded(!expanded)} className="text-sm text-blue-500">
            {expanded ? '收起' : `查看全部 ${history.length} 条`}
          </button>
        </div>
      )}
    </div>
  );
};

// 测试结果展示组件
const TestResultDisplay = ({ result, onUpdateResult }) => {
  const [feedback, setFeedback] = useState('');

  const handleRating = (rating) => {
    onUpdateResult({ ...result, rating });
  };

  return (
    <div className={`border-t ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          {result.success ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500" />
          )}
          <span className="font-semibold">
            {result.success ? '执行成功' : '执行失败'}
          </span>
          <span className="text-sm text-gray-500">({result.duration_ms}ms)</span>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4">
          <h4 className="font-medium mb-2">输出结果</h4>
          <pre className="text-sm overflow-auto max-h-64 bg-gray-50 p-3 rounded whitespace-pre-wrap">
            {result.error || JSON.stringify(result.output, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg p-4">
          <h4 className="font-medium mb-3">评价</h4>
          <div className="flex items-center gap-2 mb-3">
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => handleRating(s)}
                className={result.rating >= s ? 'text-yellow-500' : 'text-gray-300'}>
                <Star className="w-6 h-6 fill-current" />
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-3">
            <button onClick={() => handleRating(5)}
              className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              <ThumbsUp className="w-4 h-4 inline mr-1" />符合预期
            </button>
            <button onClick={() => handleRating(1)}
              className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
              <ThumbsDown className="w-4 h-4 inline mr-1" />不符合预期
            </button>
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="详细反馈..."
          />
        </div>
      </div>
    </div>
  );
};

// 执行区域组件
const ToolExecuteSection = ({
  tool, inputText, uploadedFiles, selectedDatabases,
  selectedModel, timeRange, systemPrompt, presetQuestion,
  testing, setTesting, setResult, onSaveResult
}) => {
  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('tool_id', tool.tool_id);
      formData.append('input_text', presetQuestion || inputText);
      formData.append('databases', JSON.stringify(selectedDatabases));
      formData.append('model', selectedModel);
      formData.append('time_range', timeRange.toString());
      formData.append('system_prompt', systemPrompt);
      formData.append('tool_config', JSON.stringify(tool));

      uploadedFiles.forEach((f, i) => formData.append(`file_${i}`, f.file));

      const response = await axios.post(
        `${API_BASE_URL}/tool-test/execute`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const duration = Date.now() - startTime;
      const testResult = {
        id: Date.now(),
        tool_id: tool.tool_id,
        tool_name: tool.tool_name,
        input: presetQuestion || inputText,
        output: response.data,
        success: response.data.success !== false,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        rating: null,
        feedback: ''
      };

      setResult(testResult);
      onSaveResult(testResult);
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult = {
        id: Date.now(),
        tool_id: tool.tool_id,
        tool_name: tool.tool_name,
        input: presetQuestion || inputText,
        error: error.response?.data?.detail || error.message,
        success: false,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      };
      setResult(testResult);
      onSaveResult(testResult);
    }
    setTesting(false);
  };

  return (
    <div className="p-4 border-t">
      <button
        onClick={handleTest}
        disabled={testing || (!inputText && !presetQuestion && uploadedFiles.length === 0)}
        className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Play className="w-5 h-5" />
        {testing ? '执行中...' : '执行测试'}
      </button>
    </div>
  );
};

// 输入区域组件
const ToolInputSection = ({
  inputText, setInputText, uploadedFiles,
  fileInputRef, handleFileUpload, removeFile
}) => (
  <div className="p-4 space-y-4">
    <div>
      <label className="block text-sm font-medium mb-2">输入文本 / 查询内容</label>
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 border rounded-lg"
        placeholder="输入要测试的内容..."
      />
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">上传文件（可选）</label>
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-blue-500"
      >
        <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
        <p className="text-sm text-gray-500">点击上传文件</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {uploadedFiles.length > 0 && (
        <div className="mt-2 space-y-1">
          {uploadedFiles.map((f) => (
            <div key={f.name} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
              <span>{f.name} ({(f.size/1024).toFixed(1)}KB)</span>
              <button onClick={() => removeFile(f.name)} className="text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// 工具配置区域组件
const ToolConfigSection = ({
  tool, selectedDatabases, setSelectedDatabases,
  selectedModel, setSelectedModel, timeRange, setTimeRange,
  systemPrompt, setSystemPrompt, presetQuestion, setPresetQuestion
}) => {
  const [showConfig, setShowConfig] = useState(true);

  return (
    <div className="border-b">
      <button
        onClick={() => setShowConfig(!showConfig)}
        className="w-full p-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
      >
        <span className="font-medium text-sm flex items-center gap-2">
          <Settings className="w-4 h-4" /> 工具配置
        </span>
        {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showConfig && (
        <div className="p-4 space-y-4 bg-gray-50/50">
          {/* 数据源选择 */}
          {tool.databases?.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                <Database className="w-4 h-4 inline mr-1" /> 数据源
              </label>
              <div className="flex flex-wrap gap-2">
                {DATABASE_OPTIONS.map(db => (
                  <label key={db.value} className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-white">
                    <input
                      type="checkbox"
                      checked={selectedDatabases.includes(db.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDatabases([...selectedDatabases, db.value]);
                        } else {
                          setSelectedDatabases(selectedDatabases.filter(d => d !== db.value));
                        }
                      }}
                    />
                    <span className="text-sm">{db.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 模型选择 */}
          <div>
            <label className="block text-sm font-medium mb-2">调用模型</label>
            <div className="flex flex-wrap gap-2">
              {MODEL_OPTIONS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setSelectedModel(m.value)}
                  className={`px-3 py-2 rounded-lg text-sm border transition ${
                    selectedModel === m.value
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* 时间范围 */}
          {tool.time_range_enabled && (
            <div>
              <label className="block text-sm font-medium mb-2">
                <Clock className="w-4 h-4 inline mr-1" /> 时间范围 (天)
              </label>
              <input
                type="number"
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value) || 365)}
                className="w-32 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          )}

          {/* 预置问题 */}
          {tool.preset_questions?.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">预置问题</label>
              <select
                value={presetQuestion}
                onChange={(e) => setPresetQuestion(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">-- 选择预置问题 --</option>
                {tool.preset_questions.map((q, i) => (
                  <option key={i} value={q}>{q}</option>
                ))}
              </select>
            </div>
          )}

          {/* 系统提示词 */}
          <div>
            <label className="block text-sm font-medium mb-2">系统提示词</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              placeholder="可修改系统提示词..."
            />
          </div>
        </div>
      )}
    </div>
  );
};

// 工具头部组件
const ToolHeader = ({ tool }) => (
  <div className="p-4 border-b bg-gray-50">
    <h2 className="text-xl font-bold text-gray-900">{tool.tool_name}</h2>
    <p className="text-gray-600 mt-1">{tool.description}</p>
    <div className="flex items-center gap-3 mt-2">
      <span className="text-xs px-2 py-1 bg-gray-200 rounded">{tool.category}</span>
      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
        默认模型: {tool.model}
      </span>
      {tool.time_range_enabled && (
        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
          支持时间范围
        </span>
      )}
    </div>
  </div>
);

// 工具测试面板组件
const ToolTestPanel = ({ tool, onSaveResult }) => {
  const [inputText, setInputText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  // 工具配置状态（从工具箱继承）
  const [selectedDatabases, setSelectedDatabases] = useState(tool.databases || []);
  const [selectedModel, setSelectedModel] = useState(tool.model || 'deep');
  const [timeRange, setTimeRange] = useState(tool.default_time_range || 365);
  const [systemPrompt, setSystemPrompt] = useState(tool.system_prompt || '');
  const [presetQuestion, setPresetQuestion] = useState('');

  // 当工具变化时重置配置
  useEffect(() => {
    setSelectedDatabases(tool.databases || []);
    setSelectedModel(tool.model || 'deep');
    setTimeRange(tool.default_time_range || 365);
    setSystemPrompt(tool.system_prompt || '');
    setPresetQuestion('');
    setResult(null);
  }, [tool.tool_id]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files.map(f => ({
      file: f, name: f.name, size: f.size, type: f.type
    }))]);
  };

  const removeFile = (fileName) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <ToolHeader tool={tool} />
      <ToolConfigSection
        tool={tool}
        selectedDatabases={selectedDatabases}
        setSelectedDatabases={setSelectedDatabases}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        presetQuestion={presetQuestion}
        setPresetQuestion={setPresetQuestion}
      />
      <ToolInputSection
        inputText={inputText}
        setInputText={setInputText}
        uploadedFiles={uploadedFiles}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        removeFile={removeFile}
      />
      <ToolExecuteSection
        tool={tool}
        inputText={inputText}
        uploadedFiles={uploadedFiles}
        selectedDatabases={selectedDatabases}
        selectedModel={selectedModel}
        timeRange={timeRange}
        systemPrompt={systemPrompt}
        presetQuestion={presetQuestion}
        testing={testing}
        setTesting={setTesting}
        setResult={setResult}
        onSaveResult={onSaveResult}
      />
      {result && <TestResultDisplay result={result} onUpdateResult={setResult} />}
    </div>
  );
};

// 工具列表组件
const ToolsList = ({ tools, selectedTool, onSelectTool, onRefresh }) => {
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = [...new Set(tools.map(t => t.category || '未分类'))];

  const filteredTools = tools.filter(tool => {
    const matchesText = tool.tool_name?.toLowerCase().includes(filter.toLowerCase()) ||
      tool.description?.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || tool.category === categoryFilter;
    return matchesText && matchesCategory;
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">可用工具</h2>
          <button onClick={onRefresh} className="p-2 text-gray-500 hover:text-blue-500">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <input
          type="text"
          placeholder="搜索工具..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full mt-2 px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">全部分类</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="divide-y max-h-[600px] overflow-y-auto">
        {filteredTools.map((tool) => (
          <div
            key={tool.tool_id}
            onClick={() => onSelectTool(tool)}
            className={`p-3 cursor-pointer transition ${
              selectedTool?.tool_id === tool.tool_id
                ? 'bg-blue-50 border-l-4 border-blue-500'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="font-medium text-gray-900 text-sm">{tool.tool_name}</div>
            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{tool.description}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{tool.category}</span>
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{tool.model}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToolTester;
