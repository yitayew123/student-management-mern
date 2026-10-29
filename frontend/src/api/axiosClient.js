import axios from "axios";

/** Shared Axios client for requests to the backend API. */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * Attach the saved access token to requests when a user is signed in.
 * Keep the storage key in sync with AuthContext.
 */
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

/**
 * Pass successful responses through and normalize failures for API callers.
 * A 401 outside login clears the saved session and notifies AuthContext.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Login 401s indicate invalid credentials, not an expired session.
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

/**
 * Return a user-friendly message for server, timeout, or network errors.
 */
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
