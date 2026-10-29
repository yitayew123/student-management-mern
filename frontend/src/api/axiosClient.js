import axios from "axios";

// Shared client: use the configured API URL, with a local development default.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Keep this key in sync with AuthContext; localStorage tokens are exposed to injected scripts.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Handle expired sessions globally and give callers a consistent error shape.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A login 401 means invalid credentials, not an expired session.
    const isLoginRequest = error.config?.url
      ?.replace(/\/+$/, "")
      .endsWith("/auth/login");

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("accessToken");

      // AuthContext listens for this event and clears the signed-in user.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
    const message = getApiErrorMessage(error);

    // Preserve backend error metadata alongside a readable message.
    const payload = error.response?.data?.error ?? null;

    return Promise.reject(
      Object.assign(new Error(message), {
        status: error.response?.status ?? null,
        code: payload?.code ?? null,
        details: payload?.details ?? null,
        isNetworkError: !error.response,
        cause: error,
      }),
    );
  },
);

// Convert Axios failures into messages suitable for the UI.
export function getApiErrorMessage(error) {
  // Prefer a message from the server when a response is available.
  if (error.response) {
    return (
      error.response.data?.error?.message ||
      error.response.data?.message ||
      "The request could not be completed."
    );
  }

  // Timeout and connection failures have no server response.
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return "The request timed out. Please try again.";
  }

  if (!error.response) {
    return "Unable to reach the server. Check your connection and try again.";
  }

  return error.message || "An unexpected error occurred.";
}

export default api;
