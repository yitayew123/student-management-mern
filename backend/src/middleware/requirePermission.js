const AppError = require("../utils/AppError");

/**
 * requirePermission — middleware factory that checks the current
 * user has AT LEAST ONE of the listed permissions.
 *
 * OR semantics (any of the listed permissions grants access). Use
 * for routes where a fallback permission should also work, e.g.:
 *   requirePermission("students.read", "students.read_assigned")
 *   → admins (students.read) AND instructors (students.read_assigned)
 *
 * For AND semantics (user needs ALL), wrap with multiple calls:
 *   app.use(requirePermission("a"), requirePermission("b"))
 *
 * Requires `authenticate` to have run first — this middleware
 * reads req.user.permissions, which is set by the auth middleware.
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions ?? [];

    const hasAtLeastOne = requiredPermissions.some((p) =>
      userPermissions.includes(p),
    );

    if (!hasAtLeastOne) {
      return next(
        new AppError(
          "You do not have permission to perform this action.",
          403,
          "FORBIDDEN",
        ),
      );
    }

    next();
  };
}

module.exports = requirePermission;
