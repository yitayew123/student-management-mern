const AppError = require("../utils/AppError");

// Global error-handling middleware.
// Normalizes every error into a consistent JSON response shape:
//   { success: false, error: { code, message } }
// Must be mounted LAST, after all routes and `notFound`.
function errorHandler(err, req, res, next) {
  // If a response already started, hand off to Express's default
  // handler — otherwise we'd try to write headers twice.
  if (res.headersSent) {
    return next(err);
  }

  // Defaults: treat unknown errors as a generic 500.
  // Message is deliberately generic to avoid leaking internals.
  let statusCode = err.statusCode || err.status || 500;
  let code = err.code || "INTERNAL_ERROR";
  let message = "An unexpected error occurred";

  // Body parser sent malformed JSON → client's fault (400).
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Request body contains invalid JSON";
  }

  // Body parser rejected oversized payload (express.json limit) → 413.
  else if (err.type === "entity.too.large") {
    statusCode = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body exceeds the allowed size";
  }

  // Our own AppError → safe to expose status, code, and message.
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  }

  // Log real server-side failures (5xx) for debugging/alerting,
  // but never send the stack trace to the client.
  if (statusCode >= 500) {
    console.error("Internal server error:", err);
  }

  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

module.exports = errorHandler;
