import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const chatApi = {
  queryData: async (text, history = null) => {
    const body = { text };
    if (Array.isArray(history) && history.length > 0) {
      body.history = history;
    }
    const response = await axios.post(`${API_BASE_URL}/query`, body);
    return response.data;
  },
  getDashboards: async () => {
    const response = await axios.get(`${API_BASE_URL}/dashboards`);
    return response.data;
  },
  createDashboard: async (name) => {
    const response = await axios.post(`${API_BASE_URL}/dashboards`, null, { params: { name }});
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
  }
};