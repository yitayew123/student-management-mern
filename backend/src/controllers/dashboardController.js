const { getDashboardSummary } = require("../services/dashboardService");

/**
 * GET /api/admin/dashboard
 *
 * Returns aggregate metrics (active students/courses/enrollments)
 * plus the last 5 recent enrollments. Read-only; takes no input.
 *
 * Auth: mounted behind `authenticate` + `authorize("admin", "instructor")`
 * at the router level — this controller assumes `req.user` is set but
 * doesn't use it (the dashboard shows org-wide data, not user-scoped).
 *
 * Caching: none here. The service recomputes on every call. If the
 * frontend polls this endpoint, add `Cache-Control: private, max-age=30`
 * (see notes below) — the metrics don't meaningfully change within
 * a minute.
 */
async function getSummary(req, res, next) {
  try {
    // No validation needed: there's no body, no params, no query.
    // If a `?refresh=true` or `?since=...` param is ever added,
    // validate it with Zod before touching the service.
    const data = await getDashboardSummary();

    // Standard success envelope — matches every other endpoint
    // (`{ success: true, message, data }`). The `data` shape is
    // `{ metrics: {...}, recentEnrollments: [...] }` — passed
    // through unchanged, so the service owns the response shape.
    return res.status(200).json({
      success: true,
      message: "Dashboard summary retrieved successfully.",
      data,
    });
  } catch (error) {
    // Express 4 doesn't catch async rejections — without this,
    // a throw from the service becomes an unhandled promise and
    // the request hangs. `next(error)` routes to the global
    // errorHandler, which formats AppErrors and MongoErrors.
    return next(error);
  }
}

module.exports = {
  getSummary,
};
