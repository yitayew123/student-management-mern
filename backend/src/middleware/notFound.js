// Custom error class carrying HTTP status + machine-readable code
const AppError = require("../utils/AppError");

// Catch-all middleware for unmatched routes.
// Forwards a 404 AppError to the global error handler so all
// error responses share one consistent shape (handled downstream).
// Mount AFTER all routes, BEFORE the error handler.
function notFound(req, res, next) {
  next(
    new AppError(
      `Route ${req.method} ${req.originalUrl} not found`,
      404, // HTTP status
      "ROUTE_NOT_FOUND", // stable error code for clients/monitoring
    ),
  );
}

module.exports = notFound;
