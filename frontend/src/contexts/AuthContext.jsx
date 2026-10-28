import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../api/axiosClient";

const AuthContext = createContext(null);

// ✅ This key MUST match the one used in `axiosClient.js`
// (the request interceptor reads from this same key to attach
// the Authorization header).
const TOKEN_KEY = "accessToken";

/**
 * Normalize different API response shapes.
 * Our backend wraps everything in `{ success, message, data }`,
 * but some endpoints might return the payload directly. This helper
 * ensures we always get the inner payload.
 */
function getPayload(response) {
  return response?.data?.data ?? response?.data ?? {};
}

/**
 * Extract the user object from the payload.
 * The backend might nest it under `user`, `currentUser`, or return
 * it as the root payload. This handles all three.
 */
function getUser(payload) {
  return payload?.user ?? payload?.currentUser ?? payload;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    // Note: We don't redirect here. The router config or a consuming
    // component (like a ProtectedRoute) should handle redirecting
    // to /login when `isAuthenticated` flips to false.
  }, []);

  useEffect(() => {
    // ✅ `active` flag: React 18 StrictMode mounts effects twice.
    // This flag prevents the first (aborted) mount from updating
    // state if the promise resolves after it unmounts.
    let active = true;

    // ✅ GLOBAL 401 HANDLER
    // The axiosClient interceptor dispatches `auth:unauthorized`
    // when a non-login request receives a 401. This listener
    // catches that event, clears the dead token, and sets the
    // user to null — which forces ProtectedRoute to redirect
    // to /login on the next render.
    //
    // Without this listener, the token would be removed from
    // localStorage, but `user` would remain populated in React
    // state, leaving the app in a broken "logged in but can't
    // make any API calls" state.
    const handleUnauthorized = () => {
      localStorage.removeItem(TOKEN_KEY);
      if (active) setUser(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    async function restoreSession() {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        // The axiosClient interceptor will attach the token to this request.
        const response = await api.get("/auth/me");
        const payload = getPayload(response);
        const currentUser = getUser(payload);

        if (!currentUser?.id && !currentUser?._id) {
          throw new Error("The server returned an invalid user profile.");
        }

        if (active) setUser(currentUser);
      } catch {
        // ✅ Good defensive practice: if `/auth/me` fails (e.g., token
        // expired or JWT_SECRET changed), we clear the local token so
        // we don't keep trying to use a dead token on every mount.
        localStorage.removeItem(TOKEN_KEY);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();

    // ✅ Cleanup function (replaces the previous one)
    // - Sets `active` to false (prevents state updates on unmount)
    // - Removes the global 401 listener to prevent memory leaks
    //   across mounts (e.g., in tests or future hot module reloads).
    return () => {
      active = false;
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    // ⚠️ Throws on failure (401, 500, network). The calling component
    // (e.g., LoginPage) must wrap this in try/catch to show error messages.
    const response = await api.post("/auth/login", {
      email: email.trim(),
      password,
    });

    const payload = getPayload(response);
    const accessToken = payload.accessToken ?? payload.token;
    const authenticatedUser = payload.user ?? payload.currentUser;

    if (!accessToken || !authenticatedUser) {
      throw new Error(
        "The login response did not contain a token and user profile.",
      );
    }

    // Save token first, so the interceptor can attach it to the
    // immediate follow-up request (if the LoginPage does any).
    localStorage.setItem(TOKEN_KEY, accessToken);
    setUser(authenticatedUser);

    return authenticatedUser;
  }, []);

  // ✅ useMemo prevents unnecessary re-renders of all consumers
  // if the Provider's parent re-renders (e.g., on route change).
  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook for accessing auth state.
 * Throws if used outside of AuthProvider — this catches the common
 * mistake of forgetting to wrap the app in <AuthProvider>.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
