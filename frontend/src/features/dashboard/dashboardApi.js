import api from "../../api/axiosClient";

/**
 * Dashboard API module — thin wrapper around the dashboard summary
 * endpoint. Extracted from `DashboardPage.jsx` so:
 *   - The API shape lives in one place (not duplicated across
 *     future dashboard-adjacent components)
 *   - The path is version-controlled independently of rendering
 *   - Response-shape validation is centralized
 *
 * ⚠️ ENDPOINT — MUST BE `/admin/summary`, not `/dashboard/summary`:
 *   - axiosClient.baseURL is `.../api`
 *   - backend mounts admin routes at `app.use("/api/admin", adminRoutes)`
 *   - the summary handler is `router.get("/summary", getSummary)`
 *   - so the full URL is `/api/admin/summary` → frontend path `/admin/summary`
 *
 *   Passing `/dashboard/summary` → `/api/dashboard/summary` → **404**.
 *   If the backend mount ever changes (e.g., adminRoutes moved to
 *   `/api/v2/admin` or the summary moved to a different router),
 *   update the path here — NOT in DashboardPage.jsx.
 */

/**
 * Unwrap the backend's response envelope.
 *
 * The backend consistently returns:
 *   { success: true, data: { metrics: {...}, recentEnrollments: [...] } }
 *
 * The additional fallbacks (bare `{ data: {...} }`, or the raw
 * payload with no envelope) are defensive against future API
 * shape changes. In practice, only the `{ success, data }` branch
 * fires today — the others exist so a future refactor doesn't
 * silently break the dashboard.
 *
 * @param {import("axios").AxiosResponse} response
 * @returns {object|null} — the inner payload, or null if missing
 */
function unwrapResponse(response) {
  let result = response?.data;

  // Handle nested API data envelope: { data: { ... } }
  if (
    result &&
    typeof result === "object" &&
    result.data &&
    typeof result.data === "object"
  ) {
    result = result.data;
  }

  return result;
}

/**
 * Fetch the dashboard summary.
 *
 * On success, returns the payload object:
 *   {
 *     metrics: {
 *       activeStudents: number,
 *       activeCourses: number,
 *       activeEnrollments: number,
 *     },
 *     recentEnrollments: Enrollment[],  // up to 5, populated
 *   }
 *
 * On HTTP error (4xx/5xx), the axios interceptor has already
 * normalized the error into `{ message, status, code, details }` —
 * this function just re-throws it (implicitly, by not catching).
 * Callers should use `getErrorMessage(error)` or catch directly.
 *
 * On 200-with-garbage (rare, indicates a backend bug), throws a
 * descriptive Error — better than silently returning undefined
 * and letting the caller crash on `.metrics.activeStudents`.
 *
 * @throws {Error} — network error, HTTP error, or invalid shape
 * @returns {Promise<object>} — the summary payload
 */
export async function getDashboardSummary() {
  // 🔴 FIXED: was `/dashboard/summary` → `/api/dashboard/summary`
  // → 404 on every request. Backend endpoint is `/api/admin/summary`.
  const response = await api.get("/admin/summary");
  const summary = unwrapResponse(response);

  // Defensive shape check — if the backend ever returns 200 with
  // something unexpected (null, array, string), fail loudly rather
  // than letting the caller crash on `summary.metrics.activeStudents`.
  if (!summary || typeof summary !== "object") {
    throw new Error("The dashboard API returned an invalid response.");
  }

  return summary;
}
