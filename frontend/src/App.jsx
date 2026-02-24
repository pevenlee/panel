
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ChatMessageItem from './ChatMessageItem';
import { chatApi } from './services/api';
import ChartRenderer from './components/ChartRenderer';
import SkillsAdmin from './components/SkillsAdmin';
import ToolTester from './components/ToolTester';
import ResearchPlanEditor from './components/ResearchPlanEditor';
import ToolboxManagement from './components/ToolboxManagement';
import MarketAnalysis from './components/MarketAnalysis';
import PptSlideEditor from './components/PptSlideEditor';
import { message } from 'antd';
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
  Globe, // Added for Research
  Settings, // Added for Skills Management
  GripVertical, // Added for draggable input
  Code, // Added for code display
  TrendingUp, // Added for Market Analysis
  Presentation // PPT 编辑
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

// Copy Button Component
const CopyButton = ({ text }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
      title="复制"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

import { THEME } from './theme';

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

  // Module State - 必须在使用前定义
  const [currentModule, setCurrentModule] = useState('dashboard'); // 'dashboard' | 'research' | 'report'

  // UI State - 数据看板与报告生产各自完全独立
  const [dashboardMessages, setDashboardMessages] = useState([]); // 数据看板：hcm + structure
  const [reportMessages, setReportMessages] = useState([]);      // 报告生产：ipm + fact
  const [researchMessages, setResearchMessages] = useState([]); // 市场调研模块独立

  // 独立的输入状态
  const [dashboardInput, setDashboardInput] = useState('');
  const [reportInput, setReportInput] = useState('');

  // 独立的处理状态
  const [dashboardIsProcessing, setDashboardIsProcessing] = useState(false);
  const [reportIsProcessing, setReportIsProcessing] = useState(false);

  // 独立的意图阶段状态
  const [dashboardIntentPhase, setDashboardIntentPhase] = useState('');
  const [reportIntentPhase, setReportIntentPhase] = useState('');

  // 独立的 AbortController
  const dashboardAbortRef = useRef(null);
  const reportAbortRef = useRef(null);

  // 根据当前模块选择对应状态
  const messages = currentModule === 'dashboard' ? dashboardMessages : reportMessages;
  const setCurrentModuleMessages = currentModule === 'dashboard' ? setDashboardMessages : setReportMessages;
  const input = currentModule === 'dashboard' ? dashboardInput : reportInput;
  const setInput = currentModule === 'dashboard' ? setDashboardInput : setReportInput;
  const isProcessing = currentModule === 'dashboard' ? dashboardIsProcessing : reportIsProcessing;
  const setIsProcessing = currentModule === 'dashboard' ? setDashboardIsProcessing : setReportIsProcessing;
  const intentPhase = currentModule === 'dashboard' ? dashboardIntentPhase : reportIntentPhase;
  const setIntentPhase = currentModule === 'dashboard' ? setDashboardIntentPhase : setReportIntentPhase;
  const abortControllerRef = currentModule === 'dashboard' ? dashboardAbortRef : reportAbortRef;

  const appendToModule = useCallback((msg, module) => {
    if (module === 'dashboard') setDashboardMessages(prev => [...prev, msg]);
    else setReportMessages(prev => [...prev, msg]);
  }, []);

  // Research Plan State
  const [researchPlan, setResearchPlan] = useState(null);

  // Toolbox Management State
  const [showToolboxManagement, setShowToolboxManagement] = useState(false);


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

  // 调研输入框位置状态
  const [researchInputPos, setResearchInputPos] = useState({ x: null, y: null }); // null表示使用默认居中位置
  const [isResearchInputDragging, setIsResearchInputDragging] = useState(false);
  const [researchInputDragOffset, setResearchInputDragOffset] = useState({ x: 0, y: 0 });

  // 调研输入框拖动事件处理
  useEffect(() => {
    if (!isResearchInputDragging) return;

    const handleMouseMove = (e) => {
      setResearchInputPos({
        x: e.clientX - researchInputDragOffset.x,
        y: e.clientY - researchInputDragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsResearchInputDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResearchInputDragging, researchInputDragOffset]);

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
  }, [isDashboardExpanded, isDashboardFullscreen, currentModule]);

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
    setDashboardInsight(null); // 清空旧洞察
    try {
      const res = await chatApi.generateDashboardInsight(liveDashboardItems);
      if (res && res.insight) {
        setDashboardInsight(res.insight);
      } else {
        setDashboardInsight("洞察生成完成，但未返回有效内容。请检查看板中是否有数据图表。");
      }
    } catch (e) {
      console.error("Failed to generate insight", e);
      setDashboardInsight(`洞察生成失败: ${e.response?.data?.detail || e.message || '请重试'}`);
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

  /* 处理发送消息（数据看板 / 报告生产 各自历史，不互通） */
  const handleSend = async (text = input) => {
    if ((!text || !text.trim()) && !input) return;
    const query = typeof text === 'string' ? text : input;
    const moduleForRequest = currentModule; // 固定本次请求所属模块，避免异步中切换模块串话

    // 根据模块固定状态设置函数，避免异步期间切换模块导致状态错乱
    const setModuleInput = moduleForRequest === 'dashboard' ? setDashboardInput : setReportInput;
    const setModuleIsProcessing = moduleForRequest === 'dashboard' ? setDashboardIsProcessing : setReportIsProcessing;
    const setModuleIntentPhase = moduleForRequest === 'dashboard' ? setDashboardIntentPhase : setReportIntentPhase;
    const moduleAbortRef = moduleForRequest === 'dashboard' ? dashboardAbortRef : reportAbortRef;

    // 如果处于自定义图表输入模式
    if (waitingForCustomChart && pendingChartConfig) {
      appendToModule({ role: 'user', content: query }, moduleForRequest);
      setModuleInput('');
      handleCustomChartSubmit(query);
      return;
    }

    // 如果有正在进行的请求，先中止
    if (moduleAbortRef.current) {
      moduleAbortRef.current.abort();
    }
    moduleAbortRef.current = new AbortController();
    const signal = moduleAbortRef.current.signal;

    setModuleInput('');
    setModuleIsProcessing(true);
    setModuleIntentPhase('identifying');
    setPendingChartConfig(null);

    // 添加用户消息到当前模块对话
    appendToModule({ role: 'user', content: query }, moduleForRequest);

    const sourceList = moduleForRequest === 'dashboard' ? dashboardMessages : reportMessages;
    const listWithUser = [...sourceList, { role: 'user', content: query }];
    const history = listWithUser.slice(-6).map((msg) => {
      if (msg.type === 'table_result' && msg.dataResult) {
        return { role: 'assistant', type: 'report_block', content: { mode: 'simple', summary: msg.dataResult.summary || { intent: '', logic: '' } } };
      }
      if (msg.type === 'chart_result' && msg.chartResult) {
        return { role: 'assistant', type: 'report_block', content: { mode: 'simple', summary: { intent: msg.chartResult.title, logic: '' } } };
      }
      return { role: msg.role, type: msg.type || 'text', content: typeof msg.content === 'string' ? msg.content : '' };
    });

    try {
      const intentRes = await chatApi.identifyIntent(query, history, signal);

      if (intentRes.intent === 'irrelevant') {
        setModuleIntentPhase('irrelevant');
        appendToModule({
          role: 'assistant',
          content: '抱歉，我只能回答与医药及市场数据相关的问题。请尝试询问关于销售额、市场份额或产品表现等内容。'
        }, moduleForRequest);
        return;
      }

      if (intentRes.intent === 'analysis') {
        setModuleIntentPhase('analysis');
      } else {
        setModuleIntentPhase('extract');
      }

      // 数据看板传 'dashboard'（hcm+structure），报告生产传 'report'（ipm+fact）
      const moduleParam = moduleForRequest === 'report' ? 'report' : 'dashboard';
      const result = await chatApi.queryData(query, history, moduleParam, signal);

      await new Promise(resolve => setTimeout(resolve, 800));

      const aiMsg = {
        role: 'assistant',
        type: 'table_result',
        content: result.mode === 'analysis' ? `分析完成。您可以查看下方多维报告与洞察。` : `已提取数据。您可以点击下方按钮进行操作。`,
        dataResult: { ...result, queryText: query }
      };
      appendToModule(aiMsg, moduleForRequest);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message === 'canceled') {
        setModuleInput(query);
      } else {
        console.error('Error:', err);
        appendToModule({
          role: 'assistant',
          content: `出错啦: ${err.response?.data?.detail || err.message} `
        }, moduleForRequest);
      }
    } finally {
      setModuleIsProcessing(false);
      moduleAbortRef.current = null;
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
    setCurrentModuleMessages(prev => [...prev, chartMsg]);
    setPendingChartConfig(null);
  };

  // 智能推荐：调用 Gemini API 获取最佳图表类型
  const handleSmartChart = async () => {
    if (!pendingChartConfig) return;
    const moduleForRequest = currentModule;
    setIsProcessing(true);
    setIntentPhase('charting');
    appendToModule({ role: 'assistant', content: '正在智能分析数据，推荐最佳图表类型...' }, moduleForRequest);

    try {
      const chartData = pendingChartConfig.fullData || pendingChartConfig.data;
      const result = await chatApi.suggestChart(
        chartData,
        pendingChartConfig.title,
        ''
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
      appendToModule(chartMsg, moduleForRequest);
      setPendingChartConfig(null);
    } catch (err) {
      appendToModule({
        role: 'assistant',
        content: `智能推荐失败: ${err.response?.data?.detail || err.message}，已使用默认柱状图。`
      }, moduleForRequest);
      // 失败时使用默认柱状图
      const chartMsg = {
        role: 'assistant',
        type: 'chart_result',
        content: `已生成${pendingChartConfig.title}（默认柱状图）`,
        chartResult: { ...pendingChartConfig, chartType: 'bar' }
      };
      appendToModule(chartMsg, moduleForRequest);
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

    setCurrentModuleMessages(msgs => {
      const newMessages = [...msgs];
      const msg = { ...newMessages[msgIdx] };
      if (msg.dataResult && msg.dataResult.plan) {
        const dataResult = { ...msg.dataResult };
        const plan = [...dataResult.plan];
        const newLogic = description;
        plan[itemIdx] = { ...plan[itemIdx], title, description, logic: newLogic };
        dataResult.plan = plan;
        msg.dataResult = dataResult;
        newMessages[msgIdx] = msg;
      }
      return newMessages;
    });
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
    setCurrentModuleMessages(msgs => {
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
    setCurrentModuleMessages(prev => [...prev, {
      role: 'assistant',
      content: '请输入您的图表要求（如：用折线图展示趋势、用饼图展示占比等）：'
    }]);
  };

  // 处理自定义图表的提示词输入
  const handleCustomChartSubmit = async (customPrompt) => {
    if (!pendingChartConfig || !customPrompt.trim()) return;
    const moduleForRequest = currentModule;
    setIsProcessing(true);
    setIntentPhase('charting');
    setWaitingForCustomChart(false);

    try {
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
      appendToModule(chartMsg, moduleForRequest);
      setPendingChartConfig(null);
    } catch (err) {
      appendToModule({
        role: 'assistant',
        content: `自定义图表生成失败: ${err.response?.data?.detail || err.message} `
      }, moduleForRequest);
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

    // Accumulated context from all previous steps
    let accumulatedContext = "";

    try {
      for (let i = 0; i < planItems.length; i++) {
        const step = planItems[i];
        const phase = step.phase || `步骤${i + 1}`;

        // Add progress message for this step
        setResearchMessages(prev => [...prev, {
          role: 'assistant',
          content: `⭐ **正在执行第 ${i + 1}/${planItems.length} 步: ${phase}**\n\n${step.action || step.title || '处理中'}...`,
          type: 'text'
        }]);

        // Execute this step via the new API
        const stepResult = await chatApi.executeResearchStep(step, accumulatedContext, "");

        if (stepResult && !stepResult.error) {
          // Display the step's output based on output_type
          if (stepResult.output_type === 'data_table' && stepResult.data) {
            // Data table output
            setResearchMessages(prev => [...prev, {
              role: 'assistant',
              content: stepResult.title || "数据结果",
              type: 'chart_result',
              dataResult: {
                title: stepResult.title,
                data: stepResult.data.slice(0, 20),
                fullData: stepResult.data.slice(0, 50),
                logicDescription: stepResult.content,
                mode: 'simple',
              },
            }]);
            // Add to accumulated context
            accumulatedContext += `\n\n### ${phase} 产出\n${stepResult.content}\n数据预览: ${JSON.stringify(stepResult.data.slice(0, 5))}`;
          } else if (stepResult.output_type === 'final_report') {
            // Final markdown report
            setResearchMessages(prev => [...prev, {
              role: 'assistant',
              content: `## 📝 综合分析报告\n\n${stepResult.content}`,
              type: 'text'
            }]);
            accumulatedContext += `\n\n### 综合分析\n${stepResult.content}`;
          } else {
            // Text/markdown output (analysis framework, source list, collected info)
            setResearchMessages(prev => [...prev, {
              role: 'assistant',
              content: `### ${phase} 产出\n\n${stepResult.content}`,
              type: 'text'
            }]);
            // Add to accumulated context
            accumulatedContext += `\n\n### ${phase} 产出\n${stepResult.content}`;
          }
        } else {
          // Error case
          setResearchMessages(prev => [...prev, {
            role: 'assistant',
            content: `⚠️ ${phase} 执行失败: ${stepResult?.content || stepResult?.error || '未知错误'}`,
            type: 'text'
          }]);
        }
      }

      // Final completion message
      setResearchMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **调研方案执行完成**\n\n共执行 ${planItems.length} 个步骤，正在生成 HTML 报告...`,
        type: 'text'
      }]);

      // Generate final HTML report
      try {
        // Get the original query from the first user message or use a default
        const originalQuery = researchMessages.find(m => m.role === 'user')?.content || '市场调研';

        const reportResult = await chatApi.generateResearchReport(originalQuery, accumulatedContext);

        if (reportResult && reportResult.html_content) {
          // Create a blob and download link
          const blob = new Blob([reportResult.html_content], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);

          setResearchMessages(prev => [...prev, {
            role: 'assistant',
            content: `📝 **HTML 报告已生成**`,
            type: 'html_report',
            reportUrl: url,
            filename: reportResult.filename || 'research_report.html',
          }]);
        } else if (reportResult?.error) {
          setResearchMessages(prev => [...prev, {
            role: 'assistant',
            content: `⚠️ 报告生成失败: ${reportResult.error}`,
            type: 'text'
          }]);
        }
      } catch (reportError) {
        console.error('Report generation error:', reportError);
        setResearchMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ 报告生成失败: ${reportError.message}`,
          type: 'text'
        }]);
      }
    } catch (e) {
      console.error(e);
      setResearchMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ 执行计划失败: ${e.message}`,
        type: 'text'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Wire up to the existing handleResearchSend or just component scope?
  // It's defined inside component, so it has access to state.

  const handleResearchSend = async (text = null) => {
    const promptText = text || input;
    if (!promptText.trim() || isProcessing) return;

    setInput('');
    setIsProcessing(true);
    setIntentPhase('research_plan');

    try {
      // Direct Backend Call for Market Research
      const response = await chatApi.queryData(promptText, researchMessages, 'research');

      if (response.error) {
        message.error(`Error: ${response.error}`);
      } else {
        // Update the plan state directly
        setResearchPlan(response.dataResult || response);
        message.success("已生成调研方案");
      }
    } catch (e) {
      console.error(e);
      const errMsg = e.response?.data?.detail || e.message || "服务暂时不可用";
      message.error(`Error: ${errMsg}`);
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
              { id: 'market_analysis', name: '市场分析', icon: TrendingUp },
              { id: 'research', name: '市场调研', icon: Globe },
              { id: 'report', name: '报告生产', icon: FileText },
              { id: 'ppt_editor', name: 'PPT 编辑', icon: Presentation },
              { id: 'skills', name: '工具测试', icon: Settings }
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
                            {currentModule === 'dashboard' ? '数据看板使用 HCM/架构数据，' : '报告生产使用 IPM/Fact 数据，'}可直接提问或点击预设问题：
                          </p>
                          <div className="flex flex-wrap justify-center gap-3 w-full max-w-2xl">
                            {(currentModule === 'dashboard'
                              ? ["康缘各个省份的市场表现如何？", "康缘的每个定义市场的份额是多少?", "康缘的每个大区的整体市场表现如何？"]
                              : ["各渠道销售趋势如何？", "医院与零售渠道份额对比？", "康缘的每个定义市场的份额是多少？"]
                            ).map((q, i) => (
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
                        <ChatMessageItem
                          key={idx}
                          msg={msg}
                          idx={idx}
                          pendingChartConfig={pendingChartConfig}
                          setPendingChartConfig={setPendingChartConfig}
                          setExpandedChart={setExpandedChart}
                          handleSmartChart={handleSmartChart}
                          handleCustomChartClick={handleCustomChartClick}
                          addToDashboard={addToDashboard}
                          handleRequestChart={handleRequestChart}
                          handleExecutePlan={handleExecutePlan}
                        />
                      ))}


                      {isProcessing && (
                        <div className="flex gap-3 justify-start animate-fade-in pl-0 mt-2">
                          <div className="flex-shrink-0">
                            <img src="/pmc-icon.png" alt="AI" className="w-9 h-9 rounded-full object-cover shadow-sm bg-white" onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=AI&background=8b5cf6&color=fff'; }} />
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
            )
            }


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
        {
          currentModule === 'research' && (
            <div className="flex-1 flex flex-col bg-slate-50 h-full relative">
              <div className="flex-1 relative overflow-hidden">
                <ResearchPlanEditor
                  initialPlan={researchPlan}
                  onConfirm={(steps) => console.log('Confirm plan', steps)}
                  onCancel={() => setResearchPlan(null)}
                  isStandalone={true} // Add a prop to indicate it's the main view
                />

                {/* Overlay Input for Research - Draggable */}
                <div
                  className="absolute z-40 px-4"
                  style={researchInputPos.x !== null ? {
                    left: researchInputPos.x,
                    top: researchInputPos.y,
                    transform: 'none',
                    width: '768px',
                    maxWidth: '90%'
                  } : {
                    bottom: '32px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    maxWidth: '768px'
                  }}
                >
                  <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-2 flex gap-2 items-center">
                    <div
                      className="pl-2 text-slate-400 cursor-move select-none"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.parentElement.parentElement.getBoundingClientRect();
                        setIsResearchInputDragging(true);
                        setResearchInputDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                      }}
                    >
                      <GripVertical className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                    </div>
                    <div className="text-slate-400">
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                    </div>
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isProcessing && handleResearchSend()}
                      placeholder="输入调研目标，自动生成工作流..."
                      className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 py-2"
                      disabled={isProcessing}
                    />
                    <button
                      onClick={() => handleResearchSend()}
                      disabled={!input.trim() || isProcessing}
                      className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* MODULE: MARKET ANALYSIS */}
        {
          currentModule === 'market_analysis' && (
            <div className="flex-1 h-full overflow-hidden">
              <MarketAnalysis />
            </div>
          )
        }

        {/* MODULE: PPT 编辑 - 上传 PPT，左侧章节/幻灯片拖拽排序 */}
        {
          currentModule === 'ppt_editor' && (
            <div className="flex-1 h-full overflow-hidden">
              <PptSlideEditor />
            </div>
          )
        }

        {/* MODULE: SKILLS MANAGEMENT */}
        {
          currentModule === 'skills' && (
            <div className="h-full overflow-auto">
              <ToolTester />
            </div>
          )
        }

      </div >

      {/* Toolbox Management Modal */}
      {
        showToolboxManagement && (
          <ToolboxManagement onClose={() => setShowToolboxManagement(false)} />
        )
      }
    </div >
  );
}
