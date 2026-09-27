import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

const apiClient = axios.create({ baseURL: API_URL });

export const categoryApi = {
  list: () => apiClient.get("/categories"),
};

export const transactionApi = {
  list: () => apiClient.get("/transactions"),
  create: (payload) => apiClient.post("/transactions", payload),
};

export const getApiErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;
