// ─────────────────────────────────────────────────────────────
// AppError — custom error class for expected ("operational") failures
// ─────────────────────────────────────────────────────────────
// Purpose:
//   Distinguish errors we *anticipate* (validation failures, 404s,
//   auth errors, etc.) from unexpected programmer errors (typos,
//   null derefs, DB driver crashes, etc.).
//
// Why a custom class?
//   - Carries HTTP-relevant metadata (statusCode) so the global
//     error-handling middleware doesn't need to guess the response.
//   - Carries a machine-readable `code` (e.g., "NOT_FOUND") for
//     clients / logs / monitoring to key on.
//   - `isOperational = true` lets the error handler decide whether
//     to expose the message to the client (operational = safe to
//     show) or to redact it and alert (programmer error = unsafe).
class AppError extends Error {
  /**
   * @param {string} message     Human-readable description of what went wrong.
   * @param {number} statusCode  HTTP status code to send (default: 500).
   * @param {string} code        Stable machine-readable error identifier
   *                             (default: "INTERNAL_ERROR"). Useful for
   *                             client-side `switch` logic and alerts.
   */
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    // Call the parent Error constructor so `message` and `stack`
    // behave like a normal Error (e.g., `err.message` works).
    super(message);

    // Explicitly set the error name — otherwise it would be "Error".
    // Shows up in stack traces and serialized logs.
    this.name = "AppError";

    // HTTP status code that the API should respond with.
    // Used by the global error middleware: `res.status(err.statusCode)`.
    this.statusCode = statusCode;

    // Stable, machine-readable code for the *category* of error.
    // Example values: "VALIDATION_ERROR", "NOT_FOUND", "UNAUTHORIZED".
    // Clients can branch on this without parsing message strings.
    this.code = code;

    // Marks this error as "expected" — i.e., something we deliberately
    // threw in a controller/service to signal a business-rule failure.
    // The global error handler uses this flag to decide:
    //   - true  → safe to expose `message` to the client
    //   - false → treat as a bug: log/alert + return a generic 500
    this.isOperational = true;

    // Capture a clean stack trace starting at the *caller* of
    // new AppError(...), not inside this constructor.
    // `.captureStackTrace` is a V8-only API (Node.js) so the
    // optional chaining (`?.`) keeps this code safe on other
    // runtimes (browsers, edge workers) without throwing.
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// Export the class so services/controllers can throw it and the
// global error middleware can check `err instanceof AppError`.
module.exports = AppError;
