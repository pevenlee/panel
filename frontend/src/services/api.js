import axios from 'axios';

// 后端 API 基地址：开发环境使用相对路径走 Vite 代理，生产环境使用完整地址
const BASE = import.meta.env.VITE_API_BASE_URL || '';
export const API_BASE = BASE || '';
export const API_BASE_URL = `${BASE}/api`;

export const chatApi = {
  queryData: async (text, history = null, module = null, signal = null) => {
    const body = { text };
    if (Array.isArray(history) && history.length > 0) {
      // Sanitize history to only send necessary fields and avoid large payloads
      body.history = history.map(msg => ({
        role: msg.role,
        content: msg.content,
        type: msg.type
        // Exclude dataResult, plan, etc.
      }));
    }
    if (module) {
      body.module = module;
    }
    const response = await axios.post(`${API_BASE_URL}/query`, body, { signal });
    return response.data;
  },

  identifyIntent: async (text, history = null, signal = null) => {
    const body = { text };
    if (Array.isArray(history) && history.length > 0) {
      body.history = history;
    }
    const response = await axios.post(`${API_BASE_URL}/identify-intent`, body, { signal });
    return response.data;
  },
  getDashboards: async () => {
    const response = await axios.get(`${API_BASE_URL}/dashboards`);
    return response.data;
  },
  createDashboard: async (name, role = "总经理") => {
    const response = await axios.post(`${API_BASE_URL}/dashboards`, null, { params: { name, role } });
    return response.data;
  },
  deleteDashboard: async (dashboardId) => {
    await axios.delete(`${API_BASE_URL}/dashboards/${dashboardId}`);
  },
  updateDashboard: async (dashboardId, name, role) => {
    const params = {};
    if (name) params.name = name;
    if (role) params.role = role;
    const response = await axios.put(`${API_BASE_URL}/dashboards/${dashboardId}`, null, { params });
    return response.data;
  },
  getDashboardItems: async (dashboardId) => {
    const response = await axios.get(`${API_BASE_URL}/dashboard/${dashboardId}/items`);
    return response.data;
  },
  addDashboardItem: async (item) => {
    const response = await axios.post(`${API_BASE_URL}/dashboard/items`, item);
    return response.data;
  },
  deleteDashboardItem: async (itemId) => {
    await axios.delete(`${API_BASE_URL}/dashboard/items/${itemId}`);
  },
  updateDashboardItem: async (itemId, updates) => {
    const response = await axios.put(`${API_BASE_URL}/dashboard/items/${itemId}`, updates);
    return response.data;
  },
  refreshDashboardItem: async (itemId) => {
    const response = await axios.post(`${API_BASE_URL}/dashboard/items/${itemId}/refresh`, null, { timeout: 60000 });
    return response.data;
  },
  // 图表智能推荐 / 自定义推荐
  suggestChart: async (data, title, customPrompt = '') => {
    const response = await axios.post(`${API_BASE_URL}/chart-suggest`, {
      data,
      title,
      customPrompt,
    });
    return response.data;
  },

  generateDashboardInsight: async (items) => {
    const response = await axios.post(`${API_BASE_URL}/dashboard/insight`, { items });
    return response.data;
  },

  executePlan: async (items) => {
    const response = await axios.post(`${API_BASE_URL}/execute-plan`, { items });
    return response.data;
  },

  executeResearchStep: async (step, accumulatedContext = "", metaData = "") => {
    const response = await axios.post(`${API_BASE_URL}/execute-research-step`, {
      step,
      accumulated_context: accumulatedContext,
      meta_data: metaData,
    });
    return response.data;
  },

  generateResearchReport: async (query, accumulatedContext) => {
    const response = await axios.post(`${API_BASE_URL}/generate-research-report`, {
      query,
      accumulated_context: accumulatedContext,
    });
    return response.data;
  }
};

/** 上传 PPT 并解析为幻灯片列表，用于左侧章节/幻灯片管理 */
export const pptApi = {
  parsePpt: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${API_BASE_URL}/ppt/parse`, formData);
    return response.data;
  }
};