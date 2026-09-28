import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

const apiClient = axios.create({ baseURL: API_URL });

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

export const getApiErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;
