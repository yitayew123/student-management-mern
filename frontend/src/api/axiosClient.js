import axios from "axios";

// ─────────────────────────────────────────────────────────────
// Axios instance — single client for the whole app.
// Base URL comes from Vite env (`VITE_API_URL`) at build time,
// with a localhost default for dev. Timeout protects against
// hung requests (DB slow, network stalled) — 15s is generous
// enough for cold-starts, short enough to fail fast in UX.
// ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ─────────────────────────────────────────────────────────────
// Request interceptor — attach the stored JWT to every call.
//
// ⚠️ localStorage is XSS-readable — any injected script can steal
// the token. Acceptable for a portfolio/dev project; production
// apps should use httpOnly cookies (with CSRF protection) instead.
//
// The key `"accessToken"` must stay in sync with wherever login
// writes it (`AuthContext.TOKEN_KEY`). A mismatch means every
// request goes unauthenticated — often surfaces as a mysterious
// 401 that only appears after login (because before login there
// was no token to miss).
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Response interceptor — two responsibilities:
//
//   1. Global 401 handling — if a non-login request gets a 401,
//      the session is dead (expired token, backend invalidated it,
//      or user was deleted). Clear the token and notify auth
//      listeners so the app can redirect to /login consistently.
//
//   2. Normalize every error into one shape the UI can rely on:
//        { message, status, code, details, isNetworkError }
//      Callers can then do
//        catch (err) { if (err.code === "DUPLICATE_STUDENT") ... }
//      without re-parsing axios's error shape each time.
// ─────────────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // ── Global 401 handler ────────────────────────────────────
    // WHY: Without this, an expired token makes every page show
    // an "Authentication required" banner but never redirects —
    // the user is stuck staring at a broken dashboard. AuthContext
    // doesn't know the session died because it only checks on
    // mount, not on every API call.
    //
    // HOW: Clear the token + dispatch a `auth:unauthorized` event.
    // AuthContext listens for that event and calls `logout()` —
    // which sets user=null → ProtectedRoute redirects to /login.
    //
    // `isLoginRequest` guard is essential: a 401 from `/auth/login`
    // is the *expected* response for wrong credentials. We must NOT
    // treat it as a dead session — LoginPage handles that 401
    // internally (shows "Invalid email or password"). Without the
    // guard, every failed login attempt would try to "log out" a
    // user who was never logged in — harmless but triggers a
    // spurious global event that any listener could misinterpret.
    //
    // The `.replace(/\/+$/, "")` strips trailing slashes so both
    // `/auth/login` and `/auth/login/` match.
    const isLoginRequest = error.config?.url
      ?.replace(/\/+$/, "")
      .endsWith("/auth/login");

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("accessToken");

      // `window` guard is defensive — this is a Vite SPA so it's
      // always defined, but the check makes the module safe to
      // import in SSR/test environments without a DOM.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }

    const message = getApiErrorMessage(error);

    // Backend nests error metadata under `data.error` — see
    // errorHandler.js: `{ success:false, error:{ code, message } }`.
    const payload = error.response?.data?.error ?? null;

    return Promise.reject(
      Object.assign(new Error(message), {
        status: error.response?.status ?? null,
        code: payload?.code ?? null,
        details: payload?.details ?? null,
        isNetworkError: !error.response,
        // Preserve the original axios error for debugging
        // (`console.error(err.cause)` shows the full stack).
        cause: error,
      }),
    );
  },
);

// ─────────────────────────────────────────────────────────────
// Convert any axios error into a human-readable message.
//
// Order matters: the response branch must come first because
// timeout/network errors have `error.response === undefined`.
// ─────────────────────────────────────────────────────────────
export function getApiErrorMessage(error) {
  // 1. Server responded with an error (4xx / 5xx).
  if (error.response) {
    return (
      error.response.data?.error?.message ||
      error.response.data?.message ||
      "The request could not be completed."
    );
  }

  // 2. Timeout — axios sets code "ECONNABORTED" by default;
  // "ETIMEDOUT" is also used by some axios versions.
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return "The request timed out. Please try again.";
  }

  // 3. Network failure — no response object at all (server down,
  // DNS failure, CORS preflight rejected before reaching the API).
  if (!error.response) {
    return "Unable to reach the server. Check your connection and try again.";
  }

  // 4. Fallback — unreachable in practice given the branches above,
  // kept as a safety net in case axios introduces a new error class
  // in the future that has a `.response` but no `.data`.
  return error.message || "An unexpected error occurred.";
}

export default api;
