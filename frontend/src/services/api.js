import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
});

let onUnauthorizedCallback = null;
export const setOnUnauthorizedCallback = (cb) => {
  onUnauthorizedCallback = cb;
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.url !== "/auth/login" &&
      error.config?.url !== "/auth/me"
    ) {
      if (typeof onUnauthorizedCallback === "function") {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (password) => apiClient.post("/auth/login", { password }),
  logout: () => apiClient.post("/auth/logout"),
  me: () => apiClient.get("/auth/me"),
};

export const categoryApi = {
  list: () => apiClient.get("/categories"),
  create: (payload) => apiClient.post("/categories", payload),
  update: (id, payload) => apiClient.put(`/categories/${id}`, payload),
  remove: (id) => apiClient.delete(`/categories/${id}`),
};

export const accountApi = {
  list: (includeArchived = false) => apiClient.get("/accounts", { params: { include_archived: includeArchived } }),
  getById: (id) => apiClient.get(`/accounts/${id}`),
  create: (payload) => apiClient.post("/accounts", payload),
  update: (id, payload) => apiClient.put(`/accounts/${id}`, payload),
  archive: (id, isArchived = true) => apiClient.patch(`/accounts/${id}/archive`, { is_archived: isArchived }),
  remove: (id) => apiClient.delete(`/accounts/${id}`),
};

export const transactionApi = {
  list: (params) => apiClient.get("/transactions", { params }),
  create: (payload) => apiClient.post("/transactions", payload),
  update: (id, payload) => apiClient.put(`/transactions/${id}`, payload),
  remove: (id) => apiClient.delete(`/transactions/${id}`),
  bulk: (payload) => apiClient.post("/transactions/bulk", payload),
};

export const budgetApi = {
  list: (month) => apiClient.get("/budgets", { params: { month } }),
  getById: (id) => apiClient.get(`/budgets/${id}`),
  save: (payload) => apiClient.post("/budgets", payload),
  update: (id, payload) => apiClient.put(`/budgets/${id}`, payload),
  remove: (id) => apiClient.delete(`/budgets/${id}`),
  copyPrevious: (payload) => apiClient.post("/budgets/copy-previous", payload),
};

export const reportApi = {
  getSummary: (month) => apiClient.get("/reports/summary", { params: { month: month || "all" } }),
  getByCategory: (month) => apiClient.get("/reports/by-category", { params: { month: month || "all" } }),
  getTrend: (months = 6) => apiClient.get("/reports/trend", { params: { months } }),
  getMonths: () => apiClient.get("/reports/months"),
};

export const inboxApi = {
  list: (params) => apiClient.get("/inbox", { params }),
  getStats: () => apiClient.get("/inbox/stats"),
  getById: (id) => apiClient.get(`/inbox/${id}`),
  resolve: (id, payload) => apiClient.post(`/inbox/${id}/resolve`, payload),
};

export const getApiErrorMessage = (error, fallback) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.response?.data?.errors) {
    // Handling array of errors if backend sends validation errors
    const errors = error.response.data.errors;
    return Array.isArray(errors) ? errors.join(', ') : Object.values(errors).join(', ');
  }
  if (error.response?.status === 502 || error.response?.status === 503) {
    return "Máy chủ đang khởi động lại hoặc tạm thời gián đoạn kết nối. Vui lòng bấm thử lại.";
  }
  if (error.message) {
    return error.message; // e.g. "Network Error"
  }
  return fallback || "Đã xảy ra lỗi không xác định.";
};
