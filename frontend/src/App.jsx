
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { chatApi } from './services/api';
import ChartRenderer from './components/ChartRenderer';
import {
  MessageSquare,
  Bot,
  User,
  Activity,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Database,
  BarChart2,
  PieChart, // Changed from PieChart as PieIcon
  LineChart, // Added
  MoreVertical, // Added
  Plus,
  Trash2,
  LayoutDashboard,
  FolderPlus,
  Monitor,
  Check, // Added
  X,
  Edit2,
  Edit3,
  RefreshCw,
  Maximize2,
  Square, // Added
  Sparkles, // Retained
  Wand2, // Retained
  MoreHorizontal, // Retained
  ChevronDown, // Added for dropdown
  Minimize2, // Added for fullscreen toggle
  Share2, // Added for share
  Link, // Added for copy link
  Copy, // Added for copy
  Lightbulb, // Added for insight
  ChevronUp, // Added for collapse
  FileText, // Added for Report
  CheckCircle2, // Added for Plan Confirmation
  Globe // Added for Research
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Responsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import debounce from 'lodash/debounce';

// Use Responsive directly with fixed width
const ResponsiveGridLayout = Responsive;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-600 bg-red-50 border border-red-200 rounded-lg m-4">
          <h2 className="text-lg font-bold mb-2">组件渲染错误</h2>
          <pre className="text-xs font-mono whitespace-pre-wrap">{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const THEME = {
  primaryGradient: 'from-indigo-600 to-violet-600',
  primarySolid: '#4f46e5', // Indigo 600
  secondaryGradient: 'from-orange-400 to-pink-500',
  sidebarGradient: 'from-slate-900 via-slate-800 to-indigo-950',
  glass: 'bg-white/80 backdrop-blur-md border border-white/20',
};

// 将后端返回的 records（列表 of 对象）转为 ChartRenderer 表格/图表用的 [{ name, value }]
function recordsToChartData(records) {
  if (!Array.isArray(records) || records.length === 0) return [];
  const first = records[0];
  const keys = Object.keys(first);
  if (keys.length < 2) return [];
  const nameKey = keys[0];
  const valueKey = keys[1];
  return records.map((r) => ({
    name: r[nameKey] != null ? String(r[nameKey]) : '',
    value: typeof r[valueKey] === 'number' ? r[valueKey] : Number(r[valueKey]) || 0
  }));
}

// 通用表格：渲染任意 records（列表 of 对象），表头为第一行的 key
function GenericTable({ records, maxHeight = 200, className = '' }) {
  if (!Array.isArray(records) || records.length === 0) {
    return <div className={`text-slate-400 text-sm py-2 ${className}`}>暂无数据</div>;
  }
  const keys = Object.keys(records[0]);
  return (
    <div className={`overflow-auto border border-slate-200 rounded-lg bg-white ${className}`} style={{ maxHeight }}>
      <table className="w-full text-sm text-left text-slate-600">
        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
          <tr>
            {keys.map((k) => (
              <th key={k} className="px-3 py-2 font-semibold text-slate-600">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              {keys.map((k) => (
                <td key={k} className="px-3 py-2">
                  {row[k] != null ? (typeof row[k] === 'number' ? row[k].toLocaleString() : String(row[k])) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 智能宽度计算
const getOptimalGridSpan = (chartType, data) => {
  if (chartType === 'pie') return 1;
  if (chartType === 'table') return 1;
  if (data && data.length > 12) return 2;
  return 1;
};

export default function ChatBIApp() {
  console.log('[ChatBIApp] Rendering...');

  // UI State
  const [messages, setMessages] = useState([]);
  const [researchMessages, setResearchMessages] = useState([]); // Independent state for Research Module
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [intentPhase, setIntentPhase] = useState('identifying'); // 'identifying' | 'analysis' | 'extract'
  const abortControllerRef = useRef(null);

  // Module State
  const [currentModule, setCurrentModule] = useState('dashboard'); // 'dashboard' | 'research' | 'report'


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
  const [layouts, setLayouts] = useState({ lg: [] });
  const dashboardItemsRef = useRef([]);

  // Compute layouts from dashboard items - memoized to prevent unnecessary recalculations
  const computedLayouts = useMemo(() => {
    if (dashboardItems.length === 0) return { lg: [], md: [], sm: [] };
    const baseLayout = dashboardItems.map(item => ({
      i: item.id,
      x: item.config?.layout?.x ?? (parseInt(item.id.slice(-4)) % 2) * 6,
      y: item.config?.layout?.y ?? Math.floor(parseInt(item.id.slice(-4)) / 2) * 4,
      w: item.config?.layout?.w ?? (item.gridSpan === 2 ? 12 : 6), // Default to half width (6/12)
      h: item.config?.layout?.h ?? 8,
      minW: 3,
      minH: 4
    }));
    // Use the same layout for all desktop-ish breakpoints
    return { lg: baseLayout, md: baseLayout, sm: baseLayout };
  }, [dashboardItems]);

  // Update ref for saveLayout
  useEffect(() => {
    dashboardItemsRef.current = dashboardItems;
  }, [dashboardItems]);

  // Sync layouts when computedLayouts changes (e.g. initial load or dashboard switch)
  useEffect(() => {
    setLayouts(computedLayouts);
  }, [computedLayouts]);

  const onLayoutChange = (layout, layouts) => {
    setLayouts(layouts);
    saveLayout(layout);
  };

  const saveLayout = useMemo(() => debounce(async (layout) => {
    const items = dashboardItemsRef.current;
    let hasChanges = false;

    // 1. Calculate new state locally
    const updatedItems = items.map(item => {
      const layoutItem = layout.find(l => l.i === item.id);
      if (layoutItem) {
        const currentLayout = item.config?.layout;
        // Check if changed
        if (!currentLayout || currentLayout.x !== layoutItem.x || currentLayout.y !== layoutItem.y || currentLayout.w !== layoutItem.w || currentLayout.h !== layoutItem.h) {
          hasChanges = true;
          return {
            ...item,
            config: {
              ...item.config,
              layout: {
                x: layoutItem.x,
                y: layoutItem.y,
                w: layoutItem.w,
                h: layoutItem.h
              }
            }
          };
        }
      }
      return item;
    });

    if (!hasChanges) return;

    // 2. Optimistically update local state so computedLayouts is correct
    setDashboardItems(updatedItems);

    // 3. Save layout changes to backend
    for (const l of layout) {
      const item = items.find(i => i.id === l.i);
      if (item) {
        const currentLayout = item.config?.layout;
        if (!currentLayout || currentLayout.x !== l.x || currentLayout.y !== l.y || currentLayout.w !== l.w || currentLayout.h !== l.h) {
          await chatApi.updateDashboardItem(l.i, {
            config: { ...item.config, layout: { x: l.x, y: l.y, w: l.w, h: l.h } }
          });
        }
      }
    }
  }, 500), []);

  // Layout State
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isDashboardDropdownOpen, setIsDashboardDropdownOpen] = useState(false);
  const [dashboardWidth, setDashboardWidth] = useState(800);
  const dashboardContainerRef = useRef(null);

  // Expanded View Modal State
  const [expandedChart, setExpandedChart] = useState(null);
  const [isDashboardFullscreen, setIsDashboardFullscreen] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // Plan Editing State
  const [editingPlanItem, setEditingPlanItem] = useState(null); // { msgIdx, itemIdx, logic }
  const [renamingHeadersMsgIdx, setRenamingHeadersMsgIdx] = useState(null);
  const [pendingColumnMapping, setPendingColumnMapping] = useState({});

  // Dashboard Insight State
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [dashboardInsight, setDashboardInsight] = useState(null);
  const [isInsightCollapsed, setIsInsightCollapsed] = useState(false);

  // Measure dashboard container width for responsive grid (debounced for smooth transitions)
  useEffect(() => {
    const container = dashboardContainerRef.current;
    if (!container) return;

    let rafId = null;
    let timeoutId = null;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // Cancel any pending updates
        if (rafId) cancelAnimationFrame(rafId);
        if (timeoutId) clearTimeout(timeoutId);

        // Debounce the width update for smoother transitions
        timeoutId = setTimeout(() => {
          rafId = requestAnimationFrame(() => {
            const width = entry.contentRect.width - 48; // Subtract padding
            setDashboardWidth(Math.max(400, width));
          });
        }, 50); // 50ms debounce
      }
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isDashboardExpanded, isDashboardFullscreen]);

  // Shared View State
  const [isSharedView, setIsSharedView] = useState(false);

  // 1. 初始化加载看板列表 (Updated for URL params)
  useEffect(() => {
    // Parse URL params
    const params = new URLSearchParams(window.location.search);
    const dashboardIdFromUrl = params.get('dashboard');
    const isShared = params.has('shared') || params.get('mode') === 'share';

    if (isShared) {
      setIsSharedView(true);
      setIsSidebarOpen(false); // Hide sidebar in shared view
      setIsDashboardExpanded(true); // Expand dashboard to full width
    }

    const initLoad = async () => {
      await loadDashboards(dashboardIdFromUrl);
    };
    initLoad();
  }, []);

  // 2. 切换看板时加载详情
  useEffect(() => {
    if (currentDashboardId) {
      loadDashboardItems(currentDashboardId);
      const currentDash = dashboards.find(d => d.id === currentDashboardId);
      if (currentDash) setCurrentDashboardName(currentDash.name || '看板');
    }
  }, [currentDashboardId, dashboards]);

  // Layout Switching based on Module
  useEffect(() => {
    if (currentModule === 'dashboard') {
      setIsDashboardExpanded(true); // Dashboard Mode: Show Grid + Sidebar
      if (!isSharedView) setIsSidebarOpen(true);
    } else if (currentModule === 'report') {
      setIsDashboardExpanded(false); // Report Mode: Chat Full, Hide Grid
      setIsSidebarOpen(false);
    }
  }, [currentModule, isSharedView]);

  // 3. 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- API Handlers ---
  const loadDashboards = async (preSelectedId = null) => {
    try {
      const data = await chatApi.getDashboards();
      setDashboards(data);

      // Priority: URL Param > Current ID > First Available
      const targetId = preSelectedId || currentDashboardId || (data.length > 0 ? data[0].id : null);

      if (targetId) {
        // Find name
        const dash = data.find(d => d.id === targetId);
        selectDashboard(targetId, dash ? dash.name : '看板');
      } else {
        setCurrentDashboardName('请新增看板');
      }
    } catch (e) {
      console.error("Failed to load dashboards", e);
      setCurrentDashboardName('加载失败');
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

  // Refresh all dashboard items
  const refreshAllItems = async () => {
    if (!currentDashboardId || isRefreshingAll) return;
    setIsRefreshingAll(true);
    try {
      await loadDashboardItems(currentDashboardId);
    } catch (e) {
      console.error("Failed to refresh items", e);
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const duplicateDashboardItem = async (originalItem) => {
    if (!originalItem || !currentDashboardId) return;

    // Create new ID
    const newId = `item-${Date.now()}`;

    // Create new item object
    const newItem = {
      id: newId,
      dashboardId: currentDashboardId,
      title: `${originalItem.title} (副本)`,
      config: {
        ...originalItem.config,
        title: `${originalItem.title} (副本)`,
        // Offset layout slightly so it doesn't perfectly overlap, or let auto-layout handle it (undefined)
        layout: undefined
      },
      renderData: originalItem.renderData,
      queryText: originalItem.queryText,
      gridSpan: originalItem.gridSpan
    };

    try {
      // Optimistic update
      setDashboardItems(prev => [...prev, newItem]);

      // Save to backend
      await chatApi.addDashboardItem(newItem);
    } catch (e) {
      console.error("Failed to duplicate item", e);
      // Revert if failed
      setDashboardItems(prev => prev.filter(i => i.id !== newId));
    }
  };

  // Generate Dashboard Insight
  const generateInsight = async () => {
    if (liveDashboardItems.length === 0 || isGeneratingInsight) return;
    setIsGeneratingInsight(true);
    setIsInsightCollapsed(false);
    try {
      const res = await chatApi.generateDashboardInsight(liveDashboardItems);
      if (res.insight) {
        setDashboardInsight(res.insight);
      }
    } catch (e) {
      console.error("Failed to generate insight", e);
      alert("洞察生成失败，请重试");
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  // Share dashboard - generate and copy shareable link
  const [shareTooltip, setShareTooltip] = useState('');
  const shareDashboard = async () => {
    if (!currentDashboardId) return;
    // Add shared=true to URL
    const shareUrl = `${window.location.origin}${window.location.pathname}?dashboard=${currentDashboardId}&shared=true`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareTooltip('链接已复制!');
      setTimeout(() => setShareTooltip(''), 2000);
    } catch (e) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShareTooltip('链接已复制!');
      setTimeout(() => setShareTooltip(''), 2000);
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

  const deleteDashboard = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除这个看板吗？")) return;
    try {
      await chatApi.deleteDashboard(id);
      setDashboards(prev => prev.filter(d => d.id !== id));
      if (currentDashboardId === id) {
        closeDashboard();
        setCurrentDashboardId(null);
        setCurrentDashboardName(''); // Clear the name
      }
    } catch (e) {
      console.error("Error deleting dashboard", e);
      alert("删除失败");
    }
  };

  const handleRenameDashboard = async () => {
    if (!currentDashboardId || !currentDashboardName.trim()) return;
    try {
      await chatApi.updateDashboard(currentDashboardId, currentDashboardName);
      setDashboards(prev => prev.map(d => d.id === currentDashboardId ? { ...d, name: currentDashboardName } : d));
      setIsEditingTitle(false);
    } catch (e) {
      console.error("Error updating dashboard", e);
      alert("重命名失败");
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

  /* 处理发送消息 */
  const handleSend = async (text = input) => {
    if ((!text || !text.trim()) && !input) return;
    const query = typeof text === 'string' ? text : input;

    // 如果处于自定义图表输入模式
    if (waitingForCustomChart && pendingChartConfig) {
      const userMsg = { role: 'user', content: query };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      handleCustomChartSubmit(query);
      return;
    }

    // 如果有正在进行的请求，先中止
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setInput('');
    setIsProcessing(true);
    setIntentPhase('identifying');
    setPendingChartConfig(null);

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: query }]);

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

      // 步骤 1: 快速识别意图
      const intentRes = await chatApi.identifyIntent(query, history, signal);

      if (intentRes.intent === 'irrelevant') {
        setIntentPhase('irrelevant');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '抱歉，我只能回答与医药及市场数据相关的问题。请尝试询问关于销售额、市场份额或产品表现等内容。'
        }]);
        return; // Stop processing
      }

      if (intentRes.intent === 'analysis') {
        setIntentPhase('analysis');
      } else {
        setIntentPhase('extract');
      }

      // 步骤 2: 执行具体查询
      const result = await chatApi.queryData(query, history, null, signal);

      // Small delay to show the intent type before showing result
      await new Promise(resolve => setTimeout(resolve, 800));

      const aiMsg = {
        role: 'assistant',
        type: 'table_result',
        content: result.mode === 'analysis' ? `分析完成。您可以查看下方多维报告与洞察。` : `已提取数据。您可以点击下方按钮进行操作。`,
        dataResult: { ...result, queryText: query }
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message === 'canceled') { // Handle AbortController and Axios cancellations
        // Restore input
        setInput(query);
        // Don't show abort message
      } else {
        console.error('Error:', err);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `出错啦: ${err.response?.data?.detail || err.message} `
        }]);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleRequestChart = (dataResult) => {
    setPendingChartConfig(dataResult);
    // 改为内联显示，不再发送 chart_ask 消息
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

  // 智能推荐：调用 Gemini API 获取最佳图表类型
  const handleSmartChart = async () => {
    if (!pendingChartConfig) return;
    setIsProcessing(true);
    setIntentPhase('charting');
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '正在智能分析数据，推荐最佳图表类型...'
    }]);

    try {
      // 优先使用 fullData（完整多列数据），否则使用 data
      const chartData = pendingChartConfig.fullData || pendingChartConfig.data;
      const result = await chatApi.suggestChart(
        chartData,
        pendingChartConfig.title,
        ''  // 空字符串表示智能推荐
      );

      const chartType = result.chartType || 'bar';
      const reason = result.reason || '根据数据特征推荐';
      const geminiConfig = result.config || {};

      const chartMsg = {
        role: 'assistant',
        type: 'chart_result',
        content: `智能推荐：${reason} `,
        chartResult: { ...pendingChartConfig, chartType, geminiConfig }
      };
      setMessages(prev => [...prev, chartMsg]);
      setPendingChartConfig(null);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `智能推荐失败: ${err.response?.data?.detail || err.message}，已使用默认柱状图。`
      }]);
      // 失败时使用默认柱状图
      const chartMsg = {
        role: 'assistant',
        type: 'chart_result',
        content: `已生成${pendingChartConfig.title}（默认柱状图）`,
        chartResult: { ...pendingChartConfig, chartType: 'bar' }
      };
      setMessages(prev => [...prev, chartMsg]);
      setPendingChartConfig(null);
    } finally {
      setIsProcessing(false);
      setIntentPhase('');
    }
  };

  const handleEditPlanItem = (msgIdx, itemIdx, item) => {
    setEditingPlanItem({
      msgIdx,
      itemIdx,
      title: item.title,
      description: item.description,
      logic: item.logic
    });
  };

  const handleSavePlanItem = () => {
    if (!editingPlanItem) return;
    const { msgIdx, itemIdx, title, description, logic } = editingPlanItem;

    const newMessages = [...messages];
    const msg = { ...newMessages[msgIdx] };
    if (msg.dataResult && msg.dataResult.plan) {
      const dataResult = { ...msg.dataResult };
      const plan = [...dataResult.plan];
      // Use description (users natural language) as the logic prompting
      const newLogic = description;
      plan[itemIdx] = { ...plan[itemIdx], title, description, logic: newLogic };
      dataResult.plan = plan;
      msg.dataResult = dataResult;
      newMessages[msgIdx] = msg;
      setMessages(newMessages);
    }
    setEditingPlanItem(null);
  };

  const cancelEditPlanItem = () => {
    setEditingPlanItem(null);
  };

  const handleStartRenaming = (idx, dataResult) => {
    setRenamingHeadersMsgIdx(idx);
    setPendingColumnMapping(dataResult.columnMapping || {});
  };

  const handleSaveRenaming = () => {
    if (renamingHeadersMsgIdx === null) return;
    setMessages(msgs => {
      const newMsgs = [...msgs];
      if (newMsgs[renamingHeadersMsgIdx].dataResult) {
        newMsgs[renamingHeadersMsgIdx].dataResult.columnMapping = { ...pendingColumnMapping };
      }
      return newMsgs;
    });
    setRenamingHeadersMsgIdx(null);
    setPendingColumnMapping({});
  };

  const cancelRenaming = () => {
    setRenamingHeadersMsgIdx(null);
    setPendingColumnMapping({});
  };




  // 自定义图表：用户输入提示词后调用 API
  const handleCustomChartClick = () => {
    setWaitingForCustomChart(true);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '请输入您的图表要求（如：用折线图展示趋势、用饼图展示占比等）：'
    }]);
  };

  // 处理自定义图表的提示词输入
  const handleCustomChartSubmit = async (customPrompt) => {
    if (!pendingChartConfig || !customPrompt.trim()) return;
    setIsProcessing(true);
    setIntentPhase('charting');
    setWaitingForCustomChart(false);

    try {
      // 优先使用 fullData（完整多列数据），否则使用 data
      const chartData = pendingChartConfig.fullData || pendingChartConfig.data;
      const result = await chatApi.suggestChart(
        chartData,
        pendingChartConfig.title,
        customPrompt
      );

      const chartType = result.chartType || 'bar';
      const reason = result.reason || '根据您的要求生成';
      const geminiConfig = result.config || {};

      const chartMsg = {
        role: 'assistant',
        type: 'chart_result',
        content: `自定义图表：${reason} `,
        chartResult: { ...pendingChartConfig, chartType, geminiConfig }
      };
      setMessages(prev => [...prev, chartMsg]);
      setPendingChartConfig(null);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `自定义图表生成失败: ${err.response?.data?.detail || err.message} `
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Dashboard Item Renaming State
  const [renamingDashboardItemId, setRenamingDashboardItemId] = useState(null);

  const handleStartDashboardRenaming = (item) => {
    setRenamingDashboardItemId(item.id);
    setPendingColumnMapping(item.config?.columnMapping || {});
  };

  const handleSaveDashboardRenaming = async () => {
    if (!renamingDashboardItemId) return;
    try {
      // Find current item
      const item = dashboardItems.find(i => i.id === renamingDashboardItemId);
      if (item) {
        const newConfig = { ...item.config, columnMapping: { ...pendingColumnMapping } };
        await chatApi.updateDashboardItem(renamingDashboardItemId, { config: newConfig });
        loadDashboardItems(currentDashboardId);
      }
    } catch (e) {
      console.error("Failed to update dashboard item mapping", e);
    }
    setRenamingDashboardItemId(null);
    setPendingColumnMapping({});
  };

  const cancelDashboardRenaming = () => {
    setRenamingDashboardItemId(null);
    setPendingColumnMapping({});
  };

  const addToDashboard = async (itemConfig, type, queryText = null) => {
    if (!currentDashboardId) {
      setIsSidebarOpen(true);
      alert("请先在右侧选择或创建一个看板！");
      return;
    }

    const span = getOptimalGridSpan(type, itemConfig.data);

    // Default config for grid layout
    const w = span === 2 ? 12 : 8;
    const h = 8;
    const layout = { x: 0, y: Infinity, w, h }; // Infinity puts it at the bottom

    const newItem = {
      id: Date.now().toString(),
      dashboardId: currentDashboardId,
      config: {
        ...itemConfig.config,
        chartType: type,
        geminiConfig: itemConfig.geminiConfig || {},
        columnMapping: itemConfig.columnMapping || itemConfig.config?.columnMapping || {}, // Capture mapping
        layout: layout
      },
      renderData: itemConfig.fullData || itemConfig.data,
      title: itemConfig.title,
      gridSpan: span,
      queryText: queryText || itemConfig.queryText || null
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



  const updateItemTitle = async (id, newTitle) => {
    try {
      await chatApi.updateDashboardItem(id, { title: newTitle });
      loadDashboardItems(currentDashboardId);
    } catch (e) {
      console.error("Failed to update item", e);
    }
  };

  const refreshItem = async (id) => {
    try {
      const result = await chatApi.refreshDashboardItem(id);
      if (result.status === 'refreshed') {
        loadDashboardItems(currentDashboardId);
      }
    } catch (e) {
      console.error("Failed to refresh item", e);
      alert("刷新失败：" + (e.response?.data?.detail || e.message));
    }
  };

  const handleExecutePlan = async (planItems) => {
    if (!planItems || planItems.length === 0) return;
    setIsProcessing(true);

    // Add a "Executing" message
    setResearchMessages(prev => [...prev, { role: 'assistant', content: "正在执行生产计划...", type: 'text' }]);

    try {
      const results = await chatApi.executePlan(planItems);

      if (!results || results.length === 0) {
        setResearchMessages(prev => [...prev, { role: 'assistant', content: "执行完成，但未生成有效数据。", type: 'text' }]);
      } else {
        // Add each result as a separate message or a combined block
        // For now, let's add them as separate chart_result messages
        results.forEach(res => {
          setResearchMessages(prev => [...prev, {
            role: 'assistant',
            content: "计划执行结果",
            type: 'chart_result',
            dataResult: res,
          }]);
        });
        setResearchMessages(prev => [...prev, { role: 'assistant', content: `✅ 已完成 ${results.length} 个表格的生成。`, type: 'text' }]);
      }
    } catch (e) {
      console.error(e);
      setResearchMessages(prev => [...prev, { role: 'assistant', content: "执行计划失败: " + e.message, type: 'text' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Wire up to the existing handleResearchSend or just component scope?
  // It's defined inside component, so it has access to state.

  const handleResearchSend = async (text = null) => {
    const promptText = text || input;
    if (!promptText.trim() || isProcessing) return;

    // 1. User Message
    setResearchMessages(prev => [...prev, { role: 'user', content: promptText, type: 'text' }]);
    setInput('');
    setIsProcessing(true);

    // 2. Call API
    try {
      // Use identifying intent first? Or direct query since context is specific?
      // Reusing standard flow but targeting researchMessages
      setIntentPhase('identifying');

      // a. Intent Check (Frontend simulated delay or Backend check)
      // Direct Backend Call
      const response = await chatApi.queryData(promptText, researchMessages, 'research');

      // Handle Response
      const aiMsg = {
        role: 'assistant',
        content: response.logicDescription || response.title || "已收到",
        type: response.mode === 'multi_table' ? 'plan_confirmation' : (response.data ? 'chart_result' : 'text'),
        dataResult: response.data ? response : null,
        plan: response.plan,
        // ... helper fields
      };

      // Simplify for Research View (Start with just Text + Table/Chart)
      if (response.error) {
        setResearchMessages(prev => [...prev, { role: 'assistant', content: `Error: ${response.error}`, type: 'text' }]);
      } else {
        setResearchMessages(prev => [...prev, aiMsg]);
      }

    } catch (e) {
      console.error(e);
      const errMsg = e.response?.data?.detail || e.message || "服务暂时不可用";
      setResearchMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errMsg}`, type: 'text' }]);
    } finally {
      setIsProcessing(false);
      setIntentPhase('');
    }
  };

  const [editingItemId, setEditingItemId] = useState(null);
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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 text-slate-800 font-sans overflow-hidden">

      {/* TOP NAVIGATION BAR */}
      <div className="h-14 bg-slate-900 flex items-center px-4 flex-shrink-0 justify-between shadow-md z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-white font-bold text-lg mr-4">
            {/* Logo - No Text */}
            <img src="/logo_pharmcube.png" alt="PharmCube" className="h-8 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-1">
            {[
              { id: 'dashboard', name: '数据看板', icon: LayoutDashboard },
              { id: 'research', name: '市场调研', icon: Globe },
              { id: 'report', name: '报告生产', icon: FileText }
            ].map(module => (
              <button
                key={module.id}
                onClick={() => setCurrentModule(module.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                      ${currentModule === module.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }
                    `}
              >
                <module.icon className="w-4 h-4" />
                <span>{module.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-700">
            <img src="/user-avatar.jpg" alt="User" className="w-8 h-8 rounded-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=User&background=random'; }} />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* MODULE: DASHBOARD & REPORT */}
        {(currentModule === 'dashboard' || currentModule === 'report') && (
          <>
            {/* 0. EXPANDED MODAL OVERLAY */}
            {expandedChart && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-8 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col relative overflow-hidden">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        {expandedChart.type === 'table' ? <Database className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
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
                      data={expandedChart.fullData || expandedChart.data || []}
                      title={expandedChart.title}
                      height="100%"
                      geminiConfig={expandedChart.geminiConfig || {}}
                    />
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end text-xs text-slate-400">
                    提示：您可以拖动鼠标在图表上进行区域缩放 (如果是图表类型)
                  </div>
                </div>
              </div>
            )}

            {/* 1. CHAT INTERFACE (Left) */}
            {!isSharedView && (
              <div
                className={`flex-shrink-0 flex flex-col border-r border-slate-200 bg-white shadow-xl z-10 transition-all duration-500 ease-in-out relative
          ${isChatCollapsed ? 'w-16' : (isDashboardExpanded ? 'w-[540px]' : 'flex-1')}
`}
              >
                {/* Chat Header with dashboard selector and collapse button */}
                <div className={`p-3 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-20 flex items-center ${isChatCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
                  {/* Dashboard Selector Dropdown */}
                  {!isChatCollapsed && (
                    <div className="relative">
                      {dashboards.length === 0 ? (
                        <button
                          onClick={() => createDashboard("新看板 1")}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium text-blue-600 transition-colors border border-blue-200"
                        >
                          <FolderPlus className="w-4 h-4" />
                          <span>新建看板</span>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setIsDashboardDropdownOpen(!isDashboardDropdownOpen)}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4 text-slate-500" />
                            <span className="max-w-[150px] truncate">
                              {currentDashboardName ? currentDashboardName : '选择看板'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDashboardDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {/* Dropdown Menu */}
                          {isDashboardDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                              <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">历史看板</div>
                              <div className="max-h-60 overflow-y-auto">
                                {dashboards.map(dash => (
                                  <button
                                    key={dash.id}
                                    onClick={() => {
                                      selectDashboard(dash.id, dash.name);
                                      setIsDashboardDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left
                                ${currentDashboardId === dash.id ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}
                              `}
                                  >
                                    <Monitor className={`w-4 h-4 ${currentDashboardId === dash.id ? 'text-blue-500' : 'text-slate-400'}`} />
                                    <span className="truncate flex-1">{dash.name}</span>
                                    {currentDashboardId === dash.id && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                                  </button>
                                ))}
                              </div>
                              <div className="border-t border-slate-100 mt-2 pt-2">
                                <button
                                  onClick={() => {
                                    createDashboard(`新看板 ${dashboards.length + 1}`);
                                    setIsDashboardDropdownOpen(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors text-left"
                                >
                                  <FolderPlus className="w-4 h-4" />
                                  <span>新建看板</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {/* Collapse button */}
                  <button
                    onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                    className={`p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors`}
                    title={isChatCollapsed ? '展开对话' : '折叠对话'}
                  >
                    {isChatCollapsed ? (
                      <ChevronRight className="w-5 h-5" />
                    ) : (
                      <ChevronLeft className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {/* Chat content - hidden when collapsed */}
                {!isChatCollapsed && (
                  <>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 bg-slate-50">
                      {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-70 mt-[-50px]">
                          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6">
                            <Activity className="w-10 h-10 text-blue-600" />
                          </div>
                          <h1 className="text-2xl font-bold text-slate-700 mb-2">有什么可以帮您？</h1>
                          <p className="text-slate-500 max-w-md mb-8">
                            您可以直接提问，或点击下方预设问题开始探索：
                          </p>
                          <div className="flex flex-wrap justify-center gap-3 w-full max-w-2xl">
                            {["康缘各个省份的市场表现如何？", "康缘的每个定义市场的份额是多少?", "康缘的每个大区的整体市场表现如何？"].map((q, i) => (
                              <button
                                key={i}
                                onClick={() => handleSend(q)}
                                className="py-2.5 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm whitespace-nowrap"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            {msg.role === 'user' ? (
                              <img src="/user-avatar.jpg" alt="User" className="w-9 h-9 rounded-full object-cover shadow-sm" />
                            ) : (
                              <img src="/pmc-icon.png" alt="AI" className="w-9 h-9 rounded-full object-cover shadow-sm bg-white" />
                            )}
                          </div>
                          {/* Message Content */}
                          <div
                            className={`max-w-[85%] p-4 shadow-sm text-sm leading-relaxed transition-all ${msg.role === 'user'
                              ? `bg-gradient-to-br ${THEME.primaryGradient} text-white rounded-2xl rounded-tr-sm shadow-indigo-200`
                              : msg.role === 'system'
                                ? 'bg-gradient-to-br from-slate-50 to-indigo-50/50 border border-indigo-100/50 text-slate-700 rounded-2xl rounded-tl-sm'
                                : msg.content.includes('查询出错') || msg.content.includes('出错啦') || msg.content.includes('已中止生成')
                                  ? 'bg-red-50/50 border border-red-100 text-red-700 rounded-2xl rounded-tl-sm'
                                  : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm shadow-sm'
                              } `}
                          >
                            {msg.content}

                            {/* Table Result in Chat：支持 simple（summary + tables）与 analysis（intent_analysis + angles + insight） */}
                            {msg.type === 'table_result' && msg.dataResult && (() => {
                              const dr = msg.dataResult;
                              const isAnalysis = dr.mode === 'analysis';
                              return (
                                <div className="mt-4 space-y-4">
                                  {/* Simple 模式：摘要 + 主表 + 多表 */}
                                  {dr.mode === 'simple' && (() => {
                                    const uiId = `msg_${idx} _main`;
                                    const isConfiguring = pendingChartConfig?._uiId === uiId;
                                    return (
                                      <>
                                        {dr.summary && (dr.summary.intent || dr.summary.logic) && (
                                          <div className="bg-blue-50/80 border border-blue-100 rounded-lg p-3 text-sm text-slate-700">
                                            {dr.summary.intent && <p className="font-medium text-slate-800 mb-1">{dr.summary.intent}</p>}
                                            {(dr.summary.scope || dr.summary.metrics) && <p className="text-xs text-slate-600">{[dr.summary.scope, dr.summary.metrics].filter(Boolean).join(' · ')}</p>}
                                            {dr.summary.logic && <p className="text-xs text-slate-500 mt-1">{dr.summary.logic}</p>}
                                          </div>
                                        )}
                                        <div className="bg-slate-50 rounded border border-slate-200 p-2 mb-2 relative group">
                                          <button onClick={() => setExpandedChart({ ...dr, data: dr.fullData || dr.data, type: 'table' })} className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white text-slate-400 hover:text-blue-600 rounded-md shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all z-10" title="放大查看"><Maximize2 className="w-3.5 h-3.5" /></button>
                                          <div className="text-xs text-slate-400 mb-1 font-mono">{dr.logicDescription || '数据查询结果'}</div>
                                          <ChartRenderer type="table" data={dr.fullData || dr.data || []} title={dr.title} height={180} />
                                        </div>
                                        {dr.tables && Object.keys(dr.tables).length > 1 && (
                                          <div className="space-y-2">
                                            <div className="text-xs font-semibold text-slate-500">其他结果表</div>
                                            {Object.entries(dr.tables).filter(([k]) => k !== dr.title).map(([tableName, rows]) => (
                                              <div key={tableName} className="border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">{tableName}</div>
                                                <GenericTable records={rows} maxHeight={160} />
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {isConfiguring ? (
                                          <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                            <button
                                              onClick={handleSmartChart}
                                              disabled={isProcessing}
                                              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                                            >
                                              <Sparkles className="w-3.5 h-3.5" /> 智能推荐
                                            </button>
                                            <button
                                              onClick={handleCustomChartClick}
                                              disabled={isProcessing}
                                              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold rounded-lg transition-all"
                                            >
                                              <Wand2 className="w-3.5 h-3.5" /> 自定义
                                            </button>
                                            <button
                                              onClick={() => setPendingChartConfig(null)}
                                              className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex gap-2">
                                            <button onClick={() => addToDashboard(dr, 'table')} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"><Plus className="w-3.5 h-3.5" /> 保存表格</button>
                                            <button onClick={() => handleStartRenaming(idx, dr)} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"><Edit3 className="w-3.5 h-3.5" /> 重命名</button>
                                            <button onClick={() => handleRequestChart({ ...dr, _uiId: uiId })} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"><Activity className="w-3.5 h-3.5" /> 生成图表</button>
                                          </div>
                                        )}
                                        {renamingHeadersMsgIdx === idx && (
                                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                                            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-96 overflow-hidden animate-in zoom-in-95 duration-200">
                                              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                                <h3 className="font-semibold text-slate-700">重命名表头</h3>
                                                <button onClick={cancelRenaming} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                              </div>
                                              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                                                {Object.keys(dr.fullData?.[0] || dr.data?.[0] || {}).map(col => (
                                                  <div key={col} className="space-y-1">
                                                    <label className="text-xs font-medium text-slate-500">{col}</label>
                                                    <input
                                                      type="text"
                                                      value={pendingColumnMapping[col] || dr.dataResult?.columnMapping?.[col] || (dr.columnMapping && dr.columnMapping[col]) || col}
                                                      onChange={e => setPendingColumnMapping(prev => ({ ...prev, [col]: e.target.value }))}
                                                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                                                      placeholder="新列名..."
                                                    />
                                                  </div>
                                                ))}
                                              </div>
                                              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex gap-2 justify-end">
                                                <button onClick={cancelRenaming} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
                                                <button onClick={handleSaveRenaming} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">保存更改</button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}

                                  {/* Plan Confirmation Mode */}
                                  {dr.mode === 'plan_confirmation' && (
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="font-semibold text-slate-700">{dr.title || '生产计划确认'}</h3>
                                        <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{dr.plan?.length || 0} 个表格</span>
                                      </div>
                                      <div className="p-4 space-y-3">
                                        <p className="text-sm text-slate-600 mb-2">{dr.logicDescription}</p>
                                        <div className="space-y-2">
                                          {dr.plan?.map((item, pIdx) => {
                                            const isEditing = editingPlanItem?.msgIdx === idx && editingPlanItem?.itemIdx === pIdx;
                                            return (
                                              <div key={pIdx} className="flex gap-3 p-3 bg-slate-50 rounded border border-slate-100 items-start group">
                                                <div className="mt-0.5 w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-bold shrink-0">
                                                  {pIdx + 1}
                                                </div>
                                                <div className="flex-1">
                                                  {isEditing ? (
                                                    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                                      <input
                                                        className="w-full text-sm font-medium border border-blue-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                                                        value={editingPlanItem.title}
                                                        onChange={e => setEditingPlanItem({ ...editingPlanItem, title: e.target.value })}
                                                        placeholder="表格标题"
                                                      />
                                                      <textarea
                                                        className="w-full text-xs text-slate-600 border border-blue-300 rounded px-2 py-1.5 min-h-[80px] focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none"
                                                        value={editingPlanItem.description}
                                                        onChange={e => setEditingPlanItem({ ...editingPlanItem, description: e.target.value })}
                                                        placeholder="请输入目标内容 (自然语言)..."
                                                      />
                                                      <div className="flex gap-2 justify-end">
                                                        <button onClick={handleSavePlanItem} className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded text-xs font-medium border border-green-200 transition-colors"><Check className="w-3.5 h-3.5" /> 保存</button>
                                                        <button onClick={() => setEditingPlanItem(null)} className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded text-xs font-medium transition-colors"><X className="w-3.5 h-3.5" /> 取消</button>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <>
                                                      <div className="flex justify-between items-start">
                                                        <div className="font-medium text-slate-800 text-sm">{item.title}</div>
                                                        <button
                                                          onClick={() => handleEditPlanItem(idx, pIdx, item)}
                                                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                                          title="编辑生成逻辑"
                                                        >
                                                          <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                      </div>
                                                      <div className="text-xs text-slate-500 mt-1">{item.description}</div>
                                                      <div className="text-xs text-slate-400 mt-1 italic group-hover:text-slate-500 transition-colors">
                                                        逻辑: {item.logic}
                                                      </div>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="pt-2 flex justify-end">
                                          <button
                                            onClick={() => handleExecutePlan(dr.plan)}
                                            disabled={isProcessing}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                          >
                                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                            确认并生产所有表格
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Analysis 模式：意图解析 + 多角度 + 综合洞察 */}
                                  {isAnalysis && (
                                    <>
                                      {dr.intent_analysis && (
                                        <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg p-3 text-sm text-slate-700">
                                          <ReactMarkdown components={{
                                            strong: ({ node, ...props }) => <span className="font-semibold text-indigo-700" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
                                            p: ({ node, ...props }) => <div className="mb-1 last:mb-0" {...props} />
                                          }}>{dr.intent_analysis}</ReactMarkdown>
                                        </div>
                                      )}
                                      {Array.isArray(dr.angles) && dr.angles.length > 0 && dr.angles.map((angle, aIdx) => {
                                        const hasNameValue = angle.data && angle.data[0] && angle.data[0].name != null && angle.data[0].value != null;
                                        const chartData = hasNameValue ? angle.data : recordsToChartData(angle.data || []);
                                        const multiCol = angle.data && angle.data[0] && Object.keys(angle.data[0]).length > 2 && !hasNameValue;
                                        const itemConfig = { title: angle.title, data: chartData, config: { dimension: 'name', metric: 'value' } };

                                        const uiId = `msg_${idx}_angle_${aIdx} `;
                                        const isConfiguring = pendingChartConfig?._uiId === uiId;

                                        return (
                                          <div key={aIdx} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                                              <span className="font-semibold text-slate-700">{angle.title}</span>
                                              <div className="flex gap-1">
                                                <button onClick={() => addToDashboard(itemConfig, 'table')} className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-500" title="保存表格"><Plus className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleRequestChart({ ...itemConfig, _uiId: uiId })} className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600" title="生成图表"><Activity className="w-3.5 h-3.5" /></button>
                                              </div>
                                            </div>
                                            {angle.desc && <p className="px-3 py-1 text-xs text-slate-500 border-b border-slate-100">{angle.desc}</p>}
                                            <div className="p-2">
                                              {multiCol ? <GenericTable records={angle.data} maxHeight={160} /> : (chartData.length > 0 ? <ChartRenderer type="table" data={chartData} title={angle.title} height={160} /> : <GenericTable records={angle.data || []} maxHeight={160} />)}
                                            </div>

                                            {isConfiguring && (
                                              <div className="px-2 pb-2 flex gap-2 animate-in fade-in slide-in-from-top-1 border-t border-slate-50 pt-2">
                                                <button
                                                  onClick={handleSmartChart}
                                                  disabled={isProcessing}
                                                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                                                >
                                                  <Sparkles className="w-3.5 h-3.5" /> 智能推荐
                                                </button>
                                                <button
                                                  onClick={handleCustomChartClick}
                                                  disabled={isProcessing}
                                                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold rounded-lg transition-all"
                                                >
                                                  <Wand2 className="w-3.5 h-3.5" /> 自定义
                                                </button>
                                                <button
                                                  onClick={() => setPendingChartConfig(null)}
                                                  className="px-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                                                >
                                                  <X className="w-4 h-4" />
                                                </button>
                                              </div>
                                            )}

                                            {angle.explanation && <div className="px-3 py-2 bg-amber-50/50 border-t border-slate-100 text-xs text-slate-600">{angle.explanation}</div>}
                                          </div>
                                        );
                                      })}
                                      {dr.insight && (
                                        <div className="bg-amber-50/80 border border-amber-100 rounded-lg p-3 text-sm text-slate-700">
                                          <span className="font-semibold text-slate-800 block mb-2">综合洞察</span>
                                          <ReactMarkdown components={{
                                            strong: ({ node, ...props }) => <span className="font-semibold text-indigo-700" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
                                            p: ({ node, ...props }) => <div className="mb-1 last:mb-0 leading-relaxed" {...props} />
                                          }}>{dr.insight}</ReactMarkdown>
                                        </div>
                                      )}
                                      {/* 主图表数据仍可保存/生成图表（第一个角度的数据） */}
                                      {dr.data && dr.data.length > 0 && (() => {
                                        const uiId = `msg_${idx} _analysis_main`;
                                        const isConfiguring = pendingChartConfig?._uiId === uiId;
                                        return (
                                          <>
                                            {isConfiguring ? (
                                              <div className="flex gap-2 pt-2 border-t border-slate-200 animate-in fade-in slide-in-from-top-1">
                                                <button
                                                  onClick={handleSmartChart}
                                                  disabled={isProcessing}
                                                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                                                >
                                                  <Sparkles className="w-3.5 h-3.5" /> 智能推荐
                                                </button>
                                                <button
                                                  onClick={handleCustomChartClick}
                                                  disabled={isProcessing}
                                                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold rounded-lg transition-all"
                                                >
                                                  <Wand2 className="w-3.5 h-3.5" /> 自定义
                                                </button>
                                                <button
                                                  onClick={() => setPendingChartConfig(null)}
                                                  className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                                                >
                                                  <X className="w-4 h-4" />
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="flex gap-2 pt-2 border-t border-slate-200">
                                                <button onClick={() => addToDashboard(dr, 'table')} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"><Plus className="w-3.5 h-3.5" /> 保存主表</button>
                                                <button onClick={() => handleRequestChart({ ...dr, _uiId: uiId })} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"><Activity className="w-3.5 h-3.5" /> 生成主图表</button>
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </>
                                  )}

                                  {/* 非 simple/analysis（如规则引擎返回）：仅主表 + 按钮 */}
                                  {dr.mode !== 'simple' && dr.mode !== 'plan' && !isAnalysis && dr.data && dr.data.length > 0 && (() => {
                                    const uiId = `msg_${idx} _fallback`;
                                    const isConfiguring = pendingChartConfig?._uiId === uiId;
                                    return (
                                      <>
                                        <div className="bg-slate-50 rounded border border-slate-200 p-2 mb-2 relative group">
                                          <button onClick={() => setExpandedChart({ ...dr, data: dr.fullData || dr.data, type: 'table' })} className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white text-slate-400 hover:text-blue-600 rounded-md shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all z-10" title="放大查看"><Maximize2 className="w-3.5 h-3.5" /></button>
                                          <div className="text-xs text-slate-400 mb-1 font-mono">{dr.logicDescription || '数据查询结果'}</div>
                                          <ChartRenderer type="table" data={dr.fullData || dr.data || []} title={dr.title} height={180} />
                                        </div>

                                        {isConfiguring ? (
                                          <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                            <button
                                              onClick={handleSmartChart}
                                              disabled={isProcessing}
                                              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                                            >
                                              <Sparkles className="w-3.5 h-3.5" /> 智能推荐
                                            </button>
                                            <button
                                              onClick={handleCustomChartClick}
                                              disabled={isProcessing}
                                              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold rounded-lg transition-all"
                                            >
                                              <Wand2 className="w-3.5 h-3.5" /> 自定义
                                            </button>
                                            <button
                                              onClick={() => setPendingChartConfig(null)}
                                              className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex gap-2">
                                            <button onClick={() => addToDashboard(dr, 'table')} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"><Plus className="w-3.5 h-3.5" /> 保存表格</button>
                                            <button onClick={() => handleRequestChart({ ...dr, _uiId: uiId })} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"><Activity className="w-3.5 h-3.5" /> 生成图表</button>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              );
                            })()}

                            {/*
                  移除独立的 chart_ask 渲染逻辑，因为它现在已经内联到各个表格卡片中了
                  {msg.type === 'chart_ask' && ( ... )}
                */}

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
                                    data={msg.chartResult.fullData || msg.chartResult.data || []}
                                    title={msg.chartResult.title}
                                    height={180}
                                    geminiConfig={msg.chartResult.geminiConfig || {}}
                                  />
                                </div>
                                <button
                                  onClick={() => addToDashboard(msg.chartResult, msg.chartResult.chartType)}
                                  className={`w-full flex items-center justify-center gap-2 py-2 px-4 text-white text-xs font-semibold rounded-lg shadow-sm transition-all hover:opacity-90 hover:shadow-md bg-gradient-to-r ${THEME.secondaryGradient}`}
                                >
                                  <Plus className="w-4 h-4" /> 保存到看板
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {isProcessing && (
                        <div className="flex gap-3 justify-start animate-fade-in pl-0 mt-2">
                          <div className="flex-shrink-0">
                            <img src="/pmc-icon.png" alt="AI" className="w-9 h-9 rounded-full object-cover shadow-sm bg-white" />
                          </div>
                          <div className="bg-white/90 backdrop-blur-sm rounded-2xl rounded-tl-sm py-3 px-5 shadow-sm border border-slate-100 flex items-center gap-3">
                            <div className="relative">
                              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                              <div className="absolute inset-0 bg-blue-400/20 blur-lg rounded-full animate-pulse"></div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-700">
                                {intentPhase === 'identifying' && '正在思考...'}
                                {intentPhase === 'analysis' && '正在深度分析...'}
                                {intentPhase === 'extract' && '正在查询数据...'}
                                {intentPhase === 'charting' && '正在绘制图表...'}
                                {!intentPhase && '正在处理...'}
                              </span>
                              <span className="text-xs text-slate-400">
                                {intentPhase === 'charting' ? '正在生成可视化工件' : '等待API响应...'}
                              </span>
                            </div>
                            <button onClick={handleStop} className="ml-4 px-3 py-1 bg-red-50 text-red-500 text-xs rounded-full hover:bg-red-100 border border-red-200 transition-colors">
                              停止
                            </button>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div >

                    {/* Input - Hide in Shared View */}
                    {!isSharedView && (
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
                                : 'bg-slate-100 focus:ring-2 focus:ring-blue-500 focus:bg-white'
                              }
  `}
                            disabled={isProcessing || (!!pendingChartConfig && !waitingForCustomChart)}
                          />
                          <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isProcessing}
                            className={`absolute right-2 top-2 p-1.5 text-white rounded-lg disabled:opacity-50 transition-all hover:shadow-md bg-gradient-to-r ${THEME.secondaryGradient}`}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}


            <div
              ref={dashboardContainerRef}
              className={`flex flex-col bg-slate-50 overflow-hidden transition-all duration-500 ease-in-out
          ${isDashboardFullscreen
                  ? 'fixed inset-0 z-50 h-screen w-screen'
                  : `relative h-full ${isDashboardExpanded ? 'flex-1 opacity-100 border-l border-slate-200' : 'w-0 opacity-0 border-none'}`}
`}>
              {/* Dashboard Header */}
              <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                  {!isSharedView && (
                    <button
                      onClick={() => isDashboardFullscreen ? setIsDashboardFullscreen(false) : closeDashboard()}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400"
                      title={isDashboardFullscreen ? "退出全屏" : "折叠看板"}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                  {/* Move Role Selector Here */}
                  {/* Move Role Selector Here */}
                  {currentDashboardId && (
                    <div className="relative group/role">
                      <div className={`flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold ${isSharedView ? 'cursor-default' : 'cursor-pointer border border-blue-100/50 transition-colors hover:bg-blue-100'}`}>
                        {dashboards.find(d => d.id === currentDashboardId)?.role || '总经理'}
                        {!isSharedView && <ChevronDown className="w-3 h-3 opacity-50" />}
                      </div>

                      {!isSharedView && (
                        <select
                          value={dashboards.find(d => d.id === currentDashboardId)?.role || '总经理'}
                          onChange={async (e) => {
                            const newRole = e.target.value;
                            try {
                              await chatApi.updateDashboard(currentDashboardId, null, newRole);
                              setDashboards(prev => prev.map(item => item.id === currentDashboardId ? { ...item, role: newRole } : item));
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        >
                          {['总经理', '产品总监', '大区经理', '销售负责人'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {isEditingTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={currentDashboardName}
                        onChange={(e) => setCurrentDashboardName(e.target.value)}
                        onBlur={handleRenameDashboard}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameDashboard()}
                        className="text-xl font-bold text-slate-800 border-b-2 border-blue-500 outline-none bg-transparent"
                      />
                      <button onClick={handleRenameDashboard} className="text-xs text-blue-600 font-medium">完成</button>
                    </div>
                  ) : (
                    <div className={`flex items-center gap-2 group ${isSharedView ? '' : 'cursor-pointer'}`} onClick={() => !isSharedView && setIsEditingTitle(true)}>
                      <h1 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{currentDashboardName}</h1>
                      {!isSharedView && <Edit2 className="w-4 h-4 text-slate-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!isSharedView && (
                    <>
                      <button
                        onClick={generateInsight}
                        disabled={isGeneratingInsight}
                        className={`p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors`}
                        title="生成智能洞察"
                      >
                        {isGeneratingInsight ? <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> : <Lightbulb className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={refreshAllItems}
                        disabled={isRefreshingAll}
                        className={`p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ${isRefreshingAll ? 'animate-spin' : ''}`}
                        title="刷新所有数据"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setIsDashboardFullscreen(!isDashboardFullscreen)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title={isDashboardFullscreen ? "退出全屏" : "全屏模式"}
                  >
                    {isDashboardFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </button>
                  <div className="relative">
                    <button
                      onClick={shareDashboard}
                      className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="分享看板"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    {shareTooltip && (
                      <div className="absolute top-full right-0 mt-1 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50">
                        {shareTooltip}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => currentDashboardId && deleteDashboard(currentDashboardId, e)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除当前看板"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-6 bg-[#f1f5f9]">
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
                  <div className="pb-20 h-full overflow-auto">

                    {/* Dashboard Insight Display */}
                    {dashboardInsight && (
                      <div className="mx-6 mb-4 mt-4 bg-amber-50/80 border border-amber-200 rounded-xl relative animate-in fade-in slide-in-from-top-2 overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-4 py-3 bg-amber-100/50 border-b border-amber-100">
                          <div className="flex items-center gap-2 text-amber-800 font-semibold">
                            <Sparkles className="w-4 h-4" />
                            <span>智能商业洞察</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setIsInsightCollapsed(!isInsightCollapsed)}
                              className="p-1 text-amber-600 hover:bg-amber-100 rounded transition-colors"
                              title={isInsightCollapsed ? "展开" : "折叠"}
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform ${isInsightCollapsed ? '' : 'rotate-180'}`} />
                            </button>
                            <button
                              onClick={() => setDashboardInsight(null)}
                              className="p-1 text-amber-600 hover:bg-amber-100 rounded transition-colors"
                              title="关闭"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {!isInsightCollapsed && (
                          <div className="p-4 prose prose-sm max-w-none prose-p:text-slate-700 prose-headings:text-slate-800">
                            <ReactMarkdown components={{
                              strong: ({ node, ...props }) => <span className="font-semibold text-amber-900" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
                              p: ({ node, ...props }) => <div className="mb-2 last:mb-0 leading-relaxed" {...props} />
                            }}>{dashboardInsight}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )}

                    <ErrorBoundary>
                      <ResponsiveGridLayout
                        className="layout"
                        width={dashboardWidth}
                        layouts={computedLayouts}
                        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                        cols={{ lg: 12, md: 12, sm: 12, xs: 4, xxs: 2 }}
                        rowHeight={60}
                        onLayoutChange={(layout, allLayouts) => {
                          // Sync local state immediately, but don't save to backend here
                          setLayouts(allLayouts);
                        }}
                        onDragStop={(layout) => saveLayout(layout)}
                        onResizeStop={(layout) => saveLayout(layout)}
                        isDraggable={!isSharedView}
                        isResizable={!isSharedView}
                        draggableHandle=".drag-handle"
                        margin={[24, 24]}
                        useCSSTransforms={true}
                        compactType={null}
                      >
                        {liveDashboardItems.map((item) => (
                          <div
                            key={item.id}
                            className={`bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col transition-all hover:shadow-md group relative overflow-hidden`}
                          >
                            {!isSharedView && <div className="absolute top-0 left-0 right-0 h-10 bg-transparent z-0 drag-handle cursor-move" title="按住拖动" />}
                            <div className="flex items-center justify-between p-5 pb-2 z-10 pointer-events-none relative">
                              <div className="flex items-center gap-3 pointer-events-auto">
                                {!isSharedView && <div className="w-1 h-5 rounded-full bg-gradient-to-b from-orange-400 to-pink-500 drag-handle cursor-move"></div>}
                                {editingItemId === item.id ? (
                                  <input
                                    autoFocus
                                    defaultValue={item.title}
                                    onBlur={(e) => { updateItemTitle(item.id, e.target.value); setEditingItemId(null); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { updateItemTitle(item.id, e.target.value); setEditingItemId(null); } }}
                                    className="font-bold text-slate-700 text-lg border-b-2 border-blue-500 outline-none bg-transparent w-full"
                                  />
                                ) : (
                                  <h3 className="font-bold text-slate-700 text-lg truncate pr-2" title={item.title}>{item.title}</h3>
                                )}
                                {!isSharedView && (
                                  <button
                                    onClick={() => setEditingItemId(item.id)}
                                    className="text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-blue-50 rounded"
                                    title="重命名"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1 pointer-events-auto">
                                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded">
                                  {item.config?.chartType || 'bar'}
                                </span>
                                <button
                                  onClick={() => setExpandedChart({
                                    type: item.config?.chartType || 'bar',
                                    data: item.renderData || [],
                                    fullData: item.renderData,
                                    title: item.title,
                                    geminiConfig: item.config?.geminiConfig || {}
                                  })}
                                  className="text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-blue-50 rounded-lg"
                                  title="放大查看"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                                {!isSharedView && (
                                  <>
                                    {item.queryText && (
                                      <button
                                        onClick={() => refreshItem(item.id)}
                                        className="text-slate-300 hover:text-green-600 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-green-50 rounded-lg"
                                        title="刷新数据"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => duplicateDashboardItem(item)}
                                      className="text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-indigo-50 rounded-lg"
                                      title="复制图表"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                    {(item.config?.chartType === 'table') && (
                                      <button
                                        onClick={() => handleStartDashboardRenaming(item)}
                                        className="text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-blue-50 rounded-lg"
                                        title="重命名表头"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => deleteItem(item.id)}
                                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-red-50 rounded-lg"
                                      title="删除"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 overflow-hidden p-5 pt-0 relative z-0" onMouseDown={e => e.stopPropagation()}>
                              <ChartRenderer
                                type={item.config?.chartType || 'bar'}
                                data={item.renderData || []}
                                title={""}
                                height="100%"
                                geminiConfig={item.config?.geminiConfig || {}}
                                columnMapping={item.config?.columnMapping || {}}
                              />
                            </div>
                          </div>
                        ))}
                      </ResponsiveGridLayout>
                      {/* Dashboard Item Renaming Modal */}
                      {renamingDashboardItemId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-96 overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                              <h3 className="font-semibold text-slate-700">重命名看板表头</h3>
                              <button onClick={cancelDashboardRenaming} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                              {(() => {
                                const item = dashboardItems.find(i => i.id === renamingDashboardItemId);
                                if (!item) return null;
                                const data = item.renderData || [];
                                const cols = Object.keys(data[0] || {});
                                return cols.map(col => (
                                  <div key={col} className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">{col}</label>
                                    <input
                                      type="text"
                                      value={pendingColumnMapping[col] || item.config?.columnMapping?.[col] || col}
                                      onChange={e => setPendingColumnMapping(prev => ({ ...prev, [col]: e.target.value }))}
                                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                                      placeholder="新列名..."
                                    />
                                  </div>
                                ));
                              })()}
                            </div>
                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex gap-2 justify-end">
                              <button onClick={cancelDashboardRenaming} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
                              <button onClick={handleSaveDashboardRenaming} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">保存更改</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </ErrorBoundary>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* MODULE: MARKET RESEARCH */}
        {currentModule === 'research' && (
          <div className="flex-1 flex flex-col bg-slate-50 h-full relative">

            {/* Research Header */}
            <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm flex-shrink-0 z-10">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">市场调研</h2>
              </div>
              <div className="text-sm text-slate-500">
                基于 Fact, IPM, HCM 多源数据分析 v1.0
              </div>
            </div>

            {/* Research Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
              {researchMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center -mt-10 animate-in fade-in duration-500">
                  <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                    <Globe className="w-12 h-12 text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-700 mb-2">医药市场深度调研</h3>
                  <p className="text-slate-500 max-w-lg text-center mb-8">
                    您可以查询财务状况、管线进度、人员架构变化等多维数据。
                  </p>

                  {/* Preset Questions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                    {[
                      "整理并输出2025年恒瑞、天晴、百济、信达、石药几家公司的财务状况，新增管线，以及人员架构变化",
                      "分析本月Top 5产品的市场份额及环比增长",
                      "查询江苏省内销售团队的人员分布情况",
                      "对比Fact实际销售额与IPM市场数据的差异"
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleResearchSend(q)}
                        className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-100/50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <span className="text-sm text-slate-700 font-medium group-hover:text-blue-700 transition-colors">{q}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-6 pb-4">
                  {researchMessages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-gradient-to-br from-blue-500 to-cyan-500'} shadow-sm`}>
                        {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                      </div>

                      <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-sm'
                          : 'bg-white border border-slate-150 text-slate-700 rounded-tl-sm'
                          }`}>
                          {msg.type === 'text' && <ReactMarkdown>{msg.content}</ReactMarkdown>}
                          {msg.type === 'chart_result' && (
                            <div className="space-y-3">
                              <div className="font-semibold border-b border-slate-100 pb-2 mb-2 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-500" />
                                {msg.dataResult.title || "分析结果"}
                              </div>
                              <div className="text-xs text-slate-500 mb-2">{msg.dataResult.logicDescription}</div>
                              <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                                <ChartRenderer
                                  type={msg.dataResult.config?.chartType || 'table'}
                                  data={msg.dataResult.fullData || msg.dataResult.data || []}
                                  title=""
                                  height={300}
                                  geminiConfig={msg.dataResult.config?.geminiConfig || {}}
                                  columnMapping={msg.dataResult.columnMapping || {}}
                                />
                              </div>
                            </div>
                          )}
                          {msg.type === 'plan_confirmation' && (
                            <div className="space-y-3 w-96">
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                生产计划确认
                              </div>
                              <div className="text-slate-600">{msg.dataResult.logicDescription}</div>
                              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                {msg.plan.map((item, i) => (
                                  <div key={i} className="flex gap-3 text-sm relative">
                                    {/* Step Number Line */}
                                    <div className="flex flex-col items-center">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${item.source === 'internet' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-blue-50 border-blue-200 text-blue-600'
                                        }`}>
                                        {i + 1}
                                      </div>
                                      {i < msg.plan.length - 1 && <div className="w-px h-full bg-slate-200 my-1"></div>}
                                    </div>

                                    <div className="flex-1 pb-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${item.source === 'internet'
                                          ? 'bg-indigo-100/50 text-indigo-700 border-indigo-200'
                                          : 'bg-blue-100/50 text-blue-700 border-blue-200'
                                          }`}>
                                          {item.source === 'internet' ? 'WEB SEARCH' : 'DATABASE'}
                                        </div>
                                        <div className="font-semibold text-slate-700">{item.action || item.title}</div>
                                      </div>
                                      <div className="text-slate-500 text-xs leading-relaxed">{item.rationale || item.description}</div>
                                      {item.key_question && (
                                        <div className="mt-1 text-xs text-slate-400 italic">
                                          Target: {item.key_question}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => handleExecutePlan(msg.plan)}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                disabled={isProcessing}
                              >
                                {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                确认并执行计划
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="bg-white border border-slate-150 px-5 py-3.5 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2 text-slate-500 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AI 正在分析多源数据...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Research Input Area - Fixed Bottom */}
            <div className="p-4 bg-white border-t border-slate-200">
              <div className="max-w-4xl mx-auto relative">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !isProcessing && handleResearchSend()}
                  placeholder="了解医药市场，从这里开始..."
                  className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner text-sm"
                  disabled={isProcessing}
                />
                <button
                  onClick={() => handleResearchSend()}
                  disabled={!input.trim() || isProcessing}
                  className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        )}



      </div>
    </div>
  );
}
