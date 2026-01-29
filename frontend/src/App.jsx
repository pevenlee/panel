import React, { useState, useEffect, useRef, useMemo } from 'react';
import { chatApi } from './services/api';
import ChartRenderer from './components/ChartRenderer';
import { 
  MessageSquare, Send, Plus, Trash2, RefreshCw, LayoutDashboard, 
  Database, Activity, BarChart2, PieChart as PieIcon, 
  ChevronRight, ChevronLeft, FolderPlus, Monitor, PenTool, X, Maximize2, Edit2
} from 'lucide-react';

const PHARM_BLUE = '#0f172a';
const PHARM_ORANGE = '#f97316';

// 智能宽度计算
const getOptimalGridSpan = (chartType, data) => {
  if (chartType === 'pie') return 1;
  if (chartType === 'table') return 1;
  if (data && data.length > 12) return 2;
  return 1;
};

export default function ChatBIApp() {
  // UI State
  const [messages, setMessages] = useState([
    { role: 'system', content: '你好！我是你的医药数据分析助手。你可以通过对话探索数据，或点击右侧打开看板保存分析结果。' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Flow State
  const [pendingChartConfig, setPendingChartConfig] = useState(null); 
  const [waitingForCustomChart, setWaitingForCustomChart] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Dashboard State
  const [dashboards, setDashboards] = useState([]); 
  const [currentDashboardId, setCurrentDashboardId] = useState(null); 
  const [dashboardItems, setDashboardItems] = useState([]);
  const [currentDashboardName, setCurrentDashboardName] = useState("加载中...");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  
  // Layout State
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  
  // Expanded View Modal State
  const [expandedChart, setExpandedChart] = useState(null);

  // 1. 初始化加载看板列表
  useEffect(() => {
    loadDashboards();
  }, []);

  // 2. 切换看板时加载详情
  useEffect(() => {
    if (currentDashboardId) {
      loadDashboardItems(currentDashboardId);
      const currentDash = dashboards.find(d => d.id === currentDashboardId);
      if (currentDash) setCurrentDashboardName(currentDash.name || '看板');
    }
  }, [currentDashboardId, dashboards]);

  // 3. 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- API Handlers ---
  const loadDashboards = async () => {
    try {
      const data = await chatApi.getDashboards();
      setDashboards(data);
    } catch (e) {
      console.error("Failed to load dashboards", e);
    }
  };

  const loadDashboardItems = async (id) => {
    try {
      const items = await chatApi.getDashboardItems(id);
      setDashboardItems(items);
    } catch (e) {
      console.error("Failed to load items", e);
    }
  };

  const createDashboard = async (name = "新看板") => {
    try {
      const newDash = await chatApi.createDashboard(name);
      setDashboards(prev => [...prev, newDash]);
      selectDashboard(newDash.id, newDash.name || name);
    } catch (e) {
      console.error("Error creating dashboard", e);
      alert("创建看板失败");
    }
  };

  const selectDashboard = (id, name) => {
    setCurrentDashboardId(id);
    setCurrentDashboardName(name || '看板');
    setIsDashboardExpanded(true);
    setIsSidebarOpen(false);
  };

  const closeDashboard = () => {
    setIsDashboardExpanded(false);
    setIsSidebarOpen(true);
  };

  const handleSend = async (text = input) => {
    if (!text.trim()) return;

    if (waitingForCustomChart && pendingChartConfig) {
      const userMsg = { role: 'user', content: text };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsProcessing(true);
      setWaitingForCustomChart(false); 

      setTimeout(() => {
        let type = 'bar';
        if (text.includes('线') || text.includes('趋势')) type = 'line';
        if (text.includes('饼') || text.includes('圆') || text.includes('环')) type = 'pie';
        
        const chartMsg = {
          role: 'assistant',
          type: 'chart_result',
          content: `已为您生成自定义图表。`,
          chartResult: { ...pendingChartConfig, chartType: type }
        };
        setMessages(prev => [...prev, chartMsg]);
        setPendingChartConfig(null);
        setIsProcessing(false);
      }, 600);
      return;
    }

    if (pendingChartConfig) {
      setPendingChartConfig(null);
      setWaitingForCustomChart(false);
    }

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      // 将最近几条消息转为后端历史上下文格式（供 Gemini 使用）
      const history = messages.slice(-6).map((msg) => {
        if (msg.type === 'table_result' && msg.dataResult) {
          return { role: 'assistant', type: 'report_block', content: { mode: 'simple', summary: msg.dataResult.summary || { intent: '', logic: '' } } };
        }
        if (msg.type === 'chart_result' && msg.chartResult) {
          return { role: 'assistant', type: 'report_block', content: { mode: 'simple', summary: { intent: msg.chartResult.title, logic: '' } } };
        }
        return { role: msg.role, type: msg.type || 'text', content: typeof msg.content === 'string' ? msg.content : '' };
      });
      const result = await chatApi.queryData(text, history);
      const aiMsg = { 
        role: 'assistant', 
        type: 'table_result', 
        content: result.mode === 'analysis' ? `分析完成。您可以查看下方多维报告与洞察。` : `已提取数据。您可以点击下方按钮进行操作。`,
        dataResult: result
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `查询出错: ${err.response?.data?.detail || err.message}` 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestChart = (dataResult) => {
    setPendingChartConfig(dataResult);
    setMessages(prev => [...prev, {
      role: 'assistant',
      type: 'chart_ask',
      content: '请选择图表样式：',
      relatedConfig: dataResult
    }]);
  };

  const handleSelectChartType = (type) => {
    if (!pendingChartConfig) return;
    const chartMsg = {
      role: 'assistant',
      type: 'chart_result',
      content: `已生成${pendingChartConfig.title}。`,
      chartResult: { ...pendingChartConfig, chartType: type }
    };
    setMessages(prev => [...prev, chartMsg]);
    setPendingChartConfig(null);
  };

  const handleCustomChartClick = () => {
    setWaitingForCustomChart(true);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '请输入您想要的图表样式：'
    }]);
  };

  const addToDashboard = async (itemConfig, type) => {
    if (!currentDashboardId) {
      setIsSidebarOpen(true);
      alert("请先在右侧选择或创建一个看板！");
      return;
    }
    
    const span = getOptimalGridSpan(type, itemConfig.data);

    const newItem = {
      id: Date.now().toString(),
      dashboardId: currentDashboardId, 
      config: { ...itemConfig.config, chartType: type },
      renderData: itemConfig.data,
      title: itemConfig.title,
      gridSpan: span
    };

    try {
      await chatApi.addDashboardItem(newItem);
      loadDashboardItems(currentDashboardId);
      if (!isDashboardExpanded) setIsDashboardExpanded(true);
    } catch (e) {
      console.error("Error adding item", e);
    }
  };

  const deleteItem = async (id) => {
    try {
      await chatApi.deleteDashboardItem(id);
      loadDashboardItems(currentDashboardId);
    } catch (e) {
      console.error("Failed to delete item", e);
    }
  };

  // 实时计算看板数据（基于配置重新计算）
  const liveDashboardItems = useMemo(() => {
    return dashboardItems.map(item => {
      // 如果已有 renderData，直接使用
      if (item.renderData) {
        return {
          ...item,
          gridSpan: item.gridSpan || 1
        };
      }
      // 否则返回原始数据
      return {
        ...item,
        renderData: item.renderData || [],
        gridSpan: item.gridSpan || 1
      };
    });
  }, [dashboardItems]);

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden relative">
      
      {/* 0. EXPANDED MODAL OVERLAY */}
      {expandedChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-8 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  {expandedChart.type === 'table' ? <Database className="w-5 h-5"/> : <Activity className="w-5 h-5"/>}
                </div>
                <h3 className="text-xl font-bold text-slate-800">{expandedChart.title}</h3>
              </div>
              <button 
                onClick={() => setExpandedChart(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-800"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-hidden bg-white">
              <ChartRenderer 
                type={expandedChart.type} 
                data={expandedChart.data} 
                title={expandedChart.title} 
                height="100%" 
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end text-xs text-slate-400">
              提示：您可以拖动鼠标在图表上进行区域缩放 (如果是图表类型)
            </div>
          </div>
        </div>
      )}

      {/* 1. CHAT INTERFACE (Left/Center) */}
      <div 
        className={`flex-shrink-0 flex flex-col border-r border-slate-200 bg-white shadow-xl z-10 transition-all duration-500 ease-in-out
          ${isDashboardExpanded ? 'w-[400px]' : 'flex-1'}
        `}
      >
        <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: PHARM_BLUE }}>
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-lg">医药魔方 BI</h2>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              PharmCube Intelligence
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 bg-slate-50">
          {!isDashboardExpanded && messages.length === 1 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-70 mt-[-50px]">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6">
                <Activity className="w-10 h-10 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-700 mb-2">有什么可以帮您？</h1>
              <p className="text-slate-500 max-w-md">
                尝试问我："2024Q1 各城市销售额" 或 "按省份统计销售额"
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div 
                className={`max-w-[90%] p-4 shadow-sm text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'text-white rounded-2xl rounded-tr-sm' 
                    : msg.role === 'system'
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 text-slate-700 rounded-2xl rounded-tl-sm'
                    : msg.content.includes('查询出错')
                    ? 'bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 text-red-700 rounded-2xl rounded-tl-sm'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm'
                }`}
                style={msg.role === 'user' ? { backgroundColor: PHARM_BLUE } : {}}
              >
                {msg.content}
                
                {/* Table Result in Chat */}
                {msg.type === 'table_result' && msg.dataResult && (
                  <div className="mt-4">
                    <div className="bg-slate-50 rounded border border-slate-200 p-2 mb-2 relative group">
                      {/* Maximize Button for Table */}
                      <button 
                        onClick={() => setExpandedChart({ ...msg.dataResult, type: 'table' })}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white text-slate-400 hover:text-blue-600 rounded-md shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all z-10"
                        title="放大查看"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="text-xs text-slate-400 mb-1 font-mono">{msg.dataResult.logicDescription || '数据查询结果'}</div>
                      <ChartRenderer type="table" data={msg.dataResult.data || []} title={msg.dataResult.title} height={180} />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button 
                        onClick={() => addToDashboard(msg.dataResult, 'table')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" /> 保存表格
                      </button>
                      <button 
                        onClick={() => handleRequestChart(msg.dataResult)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"
                      >
                        <Activity className="w-3.5 h-3.5" /> 生成图表
                      </button>
                    </div>
                  </div>
                )}

                {msg.type === 'chart_ask' && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      { type: 'bar', label: '柱状', icon: BarChart2 },
                      { type: 'line', label: '折线', icon: Activity },
                      { type: 'pie', label: '饼图', icon: PieIcon },
                      { type: 'custom', label: '自定义', icon: PenTool } 
                    ].map(opt => (
                      <button
                        key={opt.type}
                        onClick={() => opt.type === 'custom' ? handleCustomChartClick() : handleSelectChartType(opt.type)}
                        className={`flex flex-col items-center gap-1 p-2 border rounded-lg transition-all
                          ${opt.type === 'custom' && waitingForCustomChart 
                             ? 'bg-blue-100 border-blue-400 text-blue-700 ring-1 ring-blue-400' 
                             : 'bg-slate-50 hover:bg-blue-50 border-slate-200 hover:border-blue-200'
                          }
                        `}
                      >
                        <opt.icon className={`w-4 h-4 ${opt.type === 'custom' && waitingForCustomChart ? 'text-blue-600' : 'text-slate-500'}`} />
                        <span className={`text-[10px] ${opt.type === 'custom' && waitingForCustomChart ? 'text-blue-700 font-bold' : 'text-slate-600'}`}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Chart Result in Chat */}
                {msg.type === 'chart_result' && msg.chartResult && (
                  <div className="mt-4">
                    <div className="bg-white rounded border border-slate-100 p-2 mb-3 relative group">
                      {/* Maximize Button for Chart */}
                      <button 
                        onClick={() => setExpandedChart({ ...msg.chartResult, type: msg.chartResult.chartType })}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white text-slate-400 hover:text-blue-600 rounded-md shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all z-10"
                        title="放大查看"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      <ChartRenderer 
                        type={msg.chartResult.chartType} 
                        data={msg.chartResult.data || []} 
                        title={msg.chartResult.title} 
                        height={180} 
                      />
                    </div>
                    <button 
                      onClick={() => addToDashboard(msg.chartResult, msg.chartResult.chartType)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 text-white text-xs font-semibold rounded-lg shadow-sm transition-all hover:opacity-90"
                      style={{ backgroundColor: PHARM_ORANGE }}
                    >
                      <Plus className="w-4 h-4" /> 保存到看板
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex justify-start animate-in fade-in">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <p className="text-sm text-slate-500">正在处理...</p>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <div className="relative max-w-4xl mx-auto w-full">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                waitingForCustomChart 
                  ? "请输入图表样式 (如: 面积图)..." 
                  : (pendingChartConfig ? "请选择上方图表类型..." : "请输入分析指令，如：2024Q1各城市销售额...")
              }
              className={`w-full pl-4 pr-12 py-3.5 border-none rounded-xl transition-all outline-none text-sm shadow-sm
                ${waitingForCustomChart 
                  ? 'bg-blue-50 ring-2 ring-blue-400 placeholder-blue-400' 
                  : 'bg-slate-100 focus:ring-2 focus:ring-blue-500 focus:bg-white'}
              `}
              disabled={isProcessing || (!!pendingChartConfig && !waitingForCustomChart)}
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isProcessing}
              className="absolute right-2 top-2 p-1.5 text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: PHARM_ORANGE }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. DASHBOARD CANVAS (Right - Sliding Panel) */}
      <div className={`flex flex-col bg-slate-50 h-full overflow-hidden transition-all duration-500 ease-in-out relative
          ${isDashboardExpanded ? 'flex-1 opacity-100 border-l border-slate-200' : 'w-0 opacity-0 border-none'}
      `}>
        {/* Dashboard Header */}
        <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={closeDashboard} 
              className="p-1 hover:bg-slate-100 rounded text-slate-400"
              title="折叠看板"
            >
              <X className="w-5 h-5" />
            </button>
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input 
                  autoFocus
                  value={currentDashboardName}
                  onChange={(e) => setCurrentDashboardName(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                  className="text-xl font-bold text-slate-800 border-b-2 border-blue-500 outline-none bg-transparent"
                />
                <button onClick={() => setIsEditingTitle(false)} className="text-xs text-blue-600 font-medium">完成</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                <h1 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{currentDashboardName}</h1>
                <Edit2 className="w-4 h-4 text-slate-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#f1f5f9]">
          {liveDashboardItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-xl bg-slate-100/50 m-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                <BarChart2 className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-600 mb-2">看板暂无内容</h3>
              <p className="text-slate-400 max-w-md text-center text-sm">
                在左侧对话框生成图表后，点击"保存到看板"即可添加至此。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
              {liveDashboardItems.map((item) => (
                <div 
                  key={item.id} 
                  className={`bg-white rounded-xl shadow-sm border border-slate-100 p-5 transition-all hover:shadow-md group relative
                    ${item.gridSpan === 2 ? 'xl:col-span-2' : ''}
                  `}
                >
                  {/* Maximize Button for Dashboard Item */}
                  <button 
                    onClick={() => setExpandedChart({ ...item.config, data: item.renderData, type: item.config.chartType, title: item.title })}
                    className="absolute top-4 right-14 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-md transition-all opacity-0 group-hover:opacity-100"
                    title="放大查看"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-5 rounded-full" style={{ backgroundColor: PHARM_ORANGE }}></div>
                      <h3 className="font-bold text-slate-700 text-lg">{item.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded">
                        {item.config?.chartType || 'bar'}
                      </span>
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <ChartRenderer 
                    type={item.config?.chartType || 'bar'} 
                    data={item.renderData || []} 
                    title={item.title} 
                    height={item.config?.chartType === 'table' ? 300 : 300} 
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. RIGHT NAVIGATION SIDEBAR (Collapsible) */}
      <div 
        className={`flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out relative z-20 border-l border-slate-800 shadow-2xl
          ${isSidebarOpen ? 'w-64' : 'w-16'}
        `}
        style={{ backgroundColor: PHARM_BLUE }}
      >
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -left-3 top-6 bg-white text-slate-700 p-1 rounded-full border border-slate-200 shadow-sm hover:text-blue-600 transition-colors z-50"
        >
          {isSidebarOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        <div className="h-16 flex items-center px-4 border-b border-slate-700/50">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          {isSidebarOpen && <span className="ml-3 font-bold text-white tracking-wide truncate">看板列表</span>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2 space-y-1">
          {dashboards.map(dash => (
            <button
              key={dash.id}
              onClick={() => selectDashboard(dash.id, dash.name)}
              className={`w-full flex items-center px-3 py-3 rounded-lg transition-all group relative
                ${currentDashboardId === dash.id && isDashboardExpanded
                  ? 'bg-white/10 text-white shadow-inner' 
                  : 'hover:bg-white/5 text-slate-400 hover:text-white'}
              `}
              title={dash.name}
            >
              <Monitor className={`w-5 h-5 flex-shrink-0 ${currentDashboardId === dash.id && isDashboardExpanded ? 'text-orange-400' : 'text-slate-500 group-hover:text-white'}`} />
              
              {isSidebarOpen && (
                <div className="ml-3 text-sm font-medium truncate flex-1 text-left">
                  {dash.name}
                </div>
              )}
              
              {currentDashboardId === dash.id && isDashboardExpanded && !isSidebarOpen && (
                <div className="absolute right-1 top-1 w-2 h-2 rounded-full" style={{ backgroundColor: PHARM_ORANGE }}></div>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-700/50">
          <button 
            onClick={() => createDashboard(`新看板 ${dashboards.length + 1}`)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-600/50 hover:bg-slate-700 transition-all active:scale-95 text-white
               ${!isSidebarOpen ? 'px-0' : 'px-4'}
            `}
            title="新建看板"
          >
            <FolderPlus className="w-5 h-5" />
            {isSidebarOpen && <span className="text-sm font-medium">新建看板</span>}
          </button>
        </div>
      </div>

    </div>
  );
}
