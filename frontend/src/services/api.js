import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

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
    const response = await axios.post(`${API_BASE_URL}/dashboard/items/${itemId}/refresh`);
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
  }
};