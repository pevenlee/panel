import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Database,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  BarChart2,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatApi } from '../services/api';

// 协议卡片组件
const ProtocolCard = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-sm">
      <div className="space-y-2">
        <div className="flex border-b border-slate-800 pb-2">
          <span className="text-slate-500 w-20 flex-shrink-0 font-medium">意图识别</span>
          <span className="text-slate-300">{summary.intent || '-'}</span>
        </div>
        <div className="flex border-b border-slate-800 pb-2">
          <span className="text-slate-500 w-20 flex-shrink-0 font-medium">数据范围</span>
          <span className="text-slate-300">{summary.scope || '-'}</span>
        </div>
        <div className="flex border-b border-slate-800 pb-2">
          <span className="text-slate-500 w-20 flex-shrink-0 font-medium">计算指标</span>
          <span className="text-slate-300">{summary.metrics || '-'}</span>
        </div>
        <div className="flex">
          <span className="text-slate-500 w-20 flex-shrink-0 font-medium">计算逻辑</span>
          <span className="text-slate-300">{summary.logic || '-'}</span>
        </div>
      </div>
    </div>
  );
};

// 思考过程展示组件 - 代码默认折叠
const ThoughtProcess = ({ thought, code, isExpanded, onToggle }) => {
  const [codeExpanded, setCodeExpanded] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm mb-2"
      >
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        <span>查看思考过程 (THOUGHT PROCESS)</span>
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {thought && (
            <div className="bg-slate-900 border-l-2 border-slate-600 p-3 rounded-r-lg">
              <span className="text-slate-500 text-xs font-medium">逻辑推演:</span>
              <p className="text-slate-400 text-sm mt-1 font-mono">{thought}</p>
            </div>
          )}
          {code && (
            <div>
              <button
                onClick={() => setCodeExpanded(!codeExpanded)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-400 text-xs"
              >
                {codeExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>生成代码 {codeExpanded ? '(点击收起)' : '(点击展开)'}</span>
              </button>
              {codeExpanded && (
                <pre className="bg-slate-900 p-3 rounded-lg mt-1 overflow-x-auto">
                  <code className="text-green-400 text-xs font-mono">{code}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 数据表格组件
const DataTable = ({ data, maxRows = 50 }) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="text-slate-500 text-sm py-4">暂无数据</div>;
  }

  const columns = Object.keys(data[0]);
  const displayData = data.slice(0, maxRows);

  return (
    <div className="overflow-auto max-h-96 rounded-lg border border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-800 sticky top-0">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left text-slate-300 font-medium border-b border-slate-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-slate-900">
          {displayData.map((row, i) => (
            <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-slate-400">
                  {row[col] != null ? (
                    typeof row[col] === 'number'
                      ? row[col].toLocaleString()
                      : String(row[col])
                  ) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > maxRows && (
        <div className="bg-slate-800 px-3 py-2 text-xs text-slate-500 text-center">
          显示前 {maxRows} 条，共 {data.length} 条数据
        </div>
      )}
    </div>
  );
};

// 洞察框组件
const InsightBox = ({ content }) => {
  if (!content) return null;

  return (
    <div className="bg-slate-900 border-l-3 border-white p-4 rounded-r-lg mt-3">
      <p className="text-slate-300 text-sm italic">&gt;&gt; {content}</p>
    </div>
  );
};

// 追问按钮组件 - 支持3个问题
const FollowUpButtons = ({ questions, onSelect }) => {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-slate-400 text-sm mb-2">是否追问</h4>
      <div className="flex flex-col gap-2">
        {questions.slice(0, 3).map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(typeof q === 'string' ? q : q.question || q)}
            className="text-left px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors"
          >
            &gt; {typeof q === 'string' ? q : q.question || JSON.stringify(q)}
          </button>
        ))}
      </div>
    </div>
  );
};

// 错误提示组件
const ErrorMessage = ({ message }) => (
  <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-center gap-3">
    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
    <span className="text-red-300 text-sm">{message}</span>
  </div>
);

export default function MarketAnalysis() {
  // 状态管理
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [intentPhase, setIntentPhase] = useState('');
  const [expandedThoughts, setExpandedThoughts] = useState({});

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 切换思考过程展开状态
  const toggleThought = (msgId) => {
    setExpandedThoughts(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  // 停止处理
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setIntentPhase('');
    }
  };

  // 发送消息
  const handleSend = async (text = input) => {
    const query = typeof text === 'string' ? text.trim() : input.trim();
    if (!query || isProcessing) return;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setInput('');
    setIsProcessing(true);
    setIntentPhase('identifying');

    // 添加用户消息
    const userMsg = { id: Date.now(), role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);

    try {
      // 构建历史上下文
      const history = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
        type: msg.type || 'text'
      }));

      // 调用后端 API - 使用 'market_analysis' 模块
      setIntentPhase('analyzing');
      const result = await chatApi.queryData(
        query,
        history,
        'market_analysis',
        abortControllerRef.current.signal
      );

      // 处理响应
      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        type: 'analysis_result',
        content: result.logicDescription || '分析完成',
        data: result.fullData || result.data || [],
        summary: result.summary || null,
        thought: result.thought || result.logicDescription || null,
        code: result.code || null,
        insight: result.insight || null,
        followUpQuestions: result.followUpQuestions || [],
        mode: result.mode || 'simple'
      };

      setMessages(prev => [...prev, aiMsg]);

    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        setInput(query);
      } else {
        console.error('Market Analysis Error:', err);
        const errorMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          type: 'error',
          content: err.response?.data?.detail || err.message || '分析失败，请重试'
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsProcessing(false);
      setIntentPhase('');
      abortControllerRef.current = null;
    }
  };

  // 处理追问
  const handleFollowUp = (question) => {
    handleSend(question);
  };

  // 预设问题
  const presetQuestions = [
    "第十一批集采对中国医药市场院内外产生了什么样的影响？",
    "K药、O药、拓益、艾瑞卡、达伯舒、百泽安最近2年的销售额、份额、份额变化",
    "最新的销售数据中，零售渠道发生了哪些变化？"
  ];

  return (
    <div className="flex flex-col h-full bg-black text-slate-200">
      {/* 侧边栏 - 数据字典 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧边栏 */}
        <div className="w-64 bg-slate-950 border-r border-slate-800 p-4 overflow-y-auto flex-shrink-0">
          <h3 className="text-slate-400 text-sm font-medium mb-4">☷ 可用数据字段范围</h3>

          {/* 数据时间 */}
          <div className="mb-4">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">⏱︎ 数据时间</div>
            <div className="flex flex-wrap gap-1">
              <span className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-green-400">
                2021Q1 ~ 2025Q3
              </span>
            </div>
          </div>

          {/* 产品信息 */}
          <div className="mb-4">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">🛒 产品信息</div>
            <div className="flex flex-wrap gap-1">
              {['通用名', '商品名', '成分名', '药品名称', '生产企业', '集团名称', '剂型', '规格', 'ATC1Des', 'ATC2Des', 'ATC3Des', 'ATC4Des'].map(field => (
                <span key={field} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400">
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* 政策标签 */}
          <div className="mb-4">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">◆ 政策标签</div>
            <div className="flex flex-wrap gap-1">
              {['集采批次', '集采结果', '一致性评价', '首次上市年代', '最早医保纳入年份', '企业类型', '研究类型', 'OTC'].map(field => (
                <span key={field} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400">
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* 指标类型 */}
          <div className="mb-4">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">〽︎ 指标类型</div>
            <div className="flex flex-wrap gap-1">
              {['销售额', '销售量'].map(field => (
                <span key={field} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400">
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* 渠道范围 */}
          <div className="mb-4">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">⚙︎ 渠道范围</div>
            <div className="flex flex-wrap gap-1">
              {['医院', '零售'].map(field => (
                <span key={field} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400">
                  {field}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 mt-4">
            <p className="text-slate-600 text-xs text-center">Powered by Gemini</p>
          </div>
        </div>

        {/* 主聊天区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 欢迎界面 */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <h1 className="text-2xl font-bold text-slate-200 mb-2">
                  我们正在通过人工智能重塑医药数据
                </h1>
                <p className="text-slate-500 mb-8">点亮医药行业，有什么要问我们？</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl w-full">
                  {presetQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="text-left px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-colors"
                    >
                      ☑︎ {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 消息列表 */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-9 h-9 rounded-full bg-black border border-white flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`max-w-3xl ${msg.role === 'user' ? 'order-first' : ''}`}>
                  {/* 用户消息 */}
                  {msg.role === 'user' && (
                    <div className="bg-slate-800 rounded-2xl rounded-tr-sm px-4 py-3">
                      <span className="text-slate-500 text-xs font-medium">You &gt; </span>
                      <span className="text-slate-200">{msg.content}</span>
                    </div>
                  )}

                  {/* AI 消息 */}
                  {msg.role === 'assistant' && (
                    <div className="space-y-3">
                      {/* 错误消息 */}
                      {msg.type === 'error' && (
                        <ErrorMessage message={msg.content} />
                      )}

                      {/* 分析结果 */}
                      {msg.type === 'analysis_result' && (
                        <>
                          {/* 思考过程 */}
                          {(msg.thought || msg.code) && (
                            <ThoughtProcess
                              thought={msg.thought}
                              code={msg.code}
                              isExpanded={expandedThoughts[msg.id] ?? true}
                              onToggle={() => toggleThought(msg.id)}
                            />
                          )}

                          {/* 协议卡片 */}
                          {msg.summary && <ProtocolCard summary={msg.summary} />}

                          {/* 数据表格 */}
                          {msg.data && msg.data.length > 0 && (
                            <DataTable data={msg.data} />
                          )}

                          {/* 洞察 */}
                          {msg.insight && <InsightBox content={msg.insight} />}

                          {/* 追问按钮 */}
                          {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                            <FollowUpButtons
                              questions={msg.followUpQuestions}
                              onSelect={handleFollowUp}
                            />
                          )}
                        </>
                      )}

                      {/* 普通文本消息 */}
                      {!msg.type && (
                        <div className="bg-slate-900 rounded-2xl rounded-tl-sm px-4 py-3">
                          <span className="text-green-500 text-xs font-medium">Doc. &gt; </span>
                          <span className="text-slate-300">{msg.content}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-slate-300">U</span>
                  </div>
                )}
              </div>
            ))}

            {/* 加载状态 */}
            {isProcessing && (
              <div className="flex gap-3 justify-start">
                <div className="w-9 h-9 rounded-full bg-black border border-white flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-slate-900 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="text-slate-400 text-sm">
                    {intentPhase === 'identifying' && '正在分析意图...'}
                    {intentPhase === 'analyzing' && '正在深度分析数据...'}
                    {!intentPhase && '正在处理...'}
                  </span>
                  <button
                    onClick={handleStop}
                    className="ml-2 px-2 py-1 bg-red-900/50 text-red-400 text-xs rounded hover:bg-red-900 transition-colors"
                  >
                    停止
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入框 */}
          <div className="border-t border-slate-800 p-4 bg-black">
            <div className="max-w-4xl mx-auto relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="了解中国医药市场，从这里开始..."
                className="w-full px-4 py-3 pr-12 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
                disabled={isProcessing}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isProcessing}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-700 text-white rounded-lg disabled:opacity-50 hover:bg-slate-600 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
