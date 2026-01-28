import React, { useState, useEffect, useRef } from 'react';
import { chatApi } from './services/api';
import ChartRenderer from './components/ChartRenderer';
import { 
  MessageSquare, Send, Plus, Trash2, RefreshCw, LayoutDashboard, 
  Database, Activity, BarChart2, PieChart as PieIcon, 
  ChevronRight, ChevronLeft, FolderPlus, Monitor, PenTool, X, Maximize2, Edit2
} from 'lucide-react';

// 引入本地图片 (放在 public 文件夹可直接引用，或 import)
// 如果放在 public/company-logo.png
const COMPANY_LOGO_URL = "/company-logo.png"; 

const PHARM_BLUE = '#0f172a';
const PHARM_ORANGE = '#f97316';

export default function ChatBIApp() {
  // --- State ---
  const [messages, setMessages] = useState([
    { role: 'system', content: '你好！我是你的医药数据分析助手。数据源已连接至本地 Excel。' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingChartConfig, setPendingChartConfig] = useState(null); 
  
  // Dashboard State
  const [dashboards, setDashboards] = useState([]); 
  const [currentDashboardId, setCurrentDashboardId] = useState(null); 
  const [dashboardItems, setDashboardItems] = useState([]);
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const messagesEndRef = useRef(null);
  const [expandedChart, setExpandedChart] = useState(null);

  // --- Effects ---
  
  // 1. 初始化加载看板列表
  useEffect(() => {
    loadDashboards();
  }, []);

  // 2. 切换看板时加载详情
  useEffect(() => {
    if (currentDashboardId) {
      loadDashboardItems(currentDashboardId);
    }
  }, [currentDashboardId]);

  // 3. 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- API Handlers ---

  const loadDashboards = async () => {
    try {
      const data = await chatApi.getDashboards();
      setDashboards(data);
      if (data.length > 0 && !currentDashboardId) {
        // 可选：自动选择第一个
        // selectDashboard(data[0].id, data[0].name); 
      }
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

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // UI: 添加用户消息
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      // API Call: 发送到 Python 后端
      const result = await chatApi.queryData(userMsg.content);
      
      const aiMsg = { 
        role: 'assistant', 
        type: 'table_result', 
        content: `已根据 "${userMsg.content}" 提取数据。`,
        dataResult: result
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `查询出错: ${err.response?.data?.detail || err.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const addToDashboard = async (itemConfig, type) => {
    if (!currentDashboardId) {
       alert("请先选择一个看板！");
       return;
    }
    
    // 简单的宽度计算
    const span = (itemConfig.data && itemConfig.data.length > 12 && type !== 'pie') ? 2 : 1;

    const newItem = {
      id: Date.now().toString(), // 临时 ID，实际应由后端生成
      dashboardId: currentDashboardId,
      config: { ...itemConfig.config, chartType: type },
      renderData: itemConfig.data, // 暂存数据用于显示，实际应只存 Config
      title: itemConfig.title,
      gridSpan: span
    };

    try {
      await chatApi.addDashboardItem(newItem);
      loadDashboardItems(currentDashboardId); // 刷新
      setIsDashboardExpanded(true);
    } catch (e) {
      console.error("Error adding item", e);
    }
  };

  // ... (保留其余 UI 逻辑，如 selectDashboard, ChartRenderer 调用等)
  // ... (Render 部分与原代码高度相似，只是将 Firebase 逻辑替换为上述函数)

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden relative">
      {/* 这里复用你原来的 JSX 结构。
        重点修改：
        1. 侧边栏 Logo 处：
           <img src={COMPANY_LOGO_URL} className="w-8 h-8" />
        2. 删除原来的 generateSalesData 调用。
        3. 删除 Firebase 的 auth 逻辑。
      */}
      
      {/* 示例：侧边栏 Logo 区域 */}
      {/* ... inside Sidebar ... */}
       <div className="flex items-center gap-3 px-4 py-4">
          <img src={COMPANY_LOGO_URL} alt="Company Logo" className="w-8 h-8 rounded" />
          {isSidebarOpen && <span className="text-white font-bold">PharmCube BI</span>}
       </div>
       
       {/* ... rest of the app ... */}
    </div>
  );
}
