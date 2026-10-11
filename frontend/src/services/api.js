import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://personalfinanceapp-backend.onrender.com/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
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

    let message =
      error.response?.data?.message ||
      error.message ||
      "An unexpected network error occurred";

    if (error.code === "ECONNABORTED" || message.toLowerCase().includes("timeout")) {
      message = "The server is taking longer than usual to respond (Render free tier waking up). Please try again in a moment.";
    }

    const customError = new Error(message);
    customError.status = error.response?.status;
    customError.data = error.response?.data;

    return Promise.reject(customError);
  }
);

export default api;
export { API_BASE_URL };

