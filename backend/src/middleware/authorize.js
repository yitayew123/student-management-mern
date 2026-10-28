const AppError = require("../utils/AppError");

/**
 * Role-based access control middleware factory.
 *
 * Usage: mount AFTER `authenticate` so `req.user` is populated:
 *
 *   router.post(
 *     "/",
 *     authenticate,           // populates req.user
 *     authorize("admin"),     // gates on role
 *     controller.create
 *   );
 *
 * The factory pattern (returns a middleware) lets each route pass
 * its own allowed roles without sharing mutable state — important,
 * because the returned closure captures a private `allowedRoles` array
 * per call. A shared module-level array would let one route's config
 * leak into another's.
 */
function authorize(...allowedRoles) {
  return function (req, res, next) {
    // Defensive check: if `authenticate` didn't run (route
    // misconfigured, or middleware order changed), `req.user` is
    // undefined. Failing with a clean 401 here beats the alternative —
    // a `TypeError: Cannot read property 'role' of undefined` that
    // becomes a 500 and confuses everyone debugging.
    if (!req.user) {
      return next(
        new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED"),
      );
    }

    // Role check against the DB-sourced role on `req.user` (set by
    // `authenticate`), NOT the JWT payload. This is what makes role
    // changes take effect immediately — a demoted admin loses access
    // on their next request, not when their token expires.
    //
    // 403 (not 401): the caller IS authenticated, they just aren't
    // authorized. 401 would wrongly prompt clients to re-authenticate.
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "FORBIDDEN",
        ),
      );
    }

    // Authorized — hand control to the next middleware / controller.
    next();
  };
}

module.exports = authorize;
