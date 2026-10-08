import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

const apiClient = axios.create({ baseURL: API_URL, timeout: 10000 });

export const categoryApi = {
  list: () => apiClient.get("/categories"),
  create: (payload) => apiClient.post("/categories", payload),
  update: (id, payload) => apiClient.put(`/categories/${id}`, payload),
  remove: (id) => apiClient.delete(`/categories/${id}`),
};

export const transactionApi = {
  list: () => apiClient.get("/transactions"),
  create: (payload) => apiClient.post("/transactions", payload),
  update: (id, payload) => apiClient.put(`/transactions/${id}`, payload),
  remove: (id) => apiClient.delete(`/transactions/${id}`),
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
  if (error.message) {
    return error.message; // e.g. "Network Error"
  }
  return fallback || "Đã xảy ra lỗi không xác định.";
};
