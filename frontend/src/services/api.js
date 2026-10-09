import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Request interceptor: Attach JWT token if stored
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("pfa_auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Format errors consistently
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle unauthenticated 401 response globally
    if (error.response && error.response.status === 401) {
      // Clear invalid token from storage
      localStorage.removeItem("pfa_auth_token");
      localStorage.removeItem("pfa_auth_user");
    }

    const message =
      error.response?.data?.message ||
      error.message ||
      "An unexpected network error occurred";

    const customError = new Error(message);
    customError.status = error.response?.status;
    customError.data = error.response?.data;

    return Promise.reject(customError);
  }
);

export default api;
export { API_BASE_URL };

