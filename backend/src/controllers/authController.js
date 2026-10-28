const authService = require("../services/authService");
const AppError = require("../utils/AppError");

/**
 * POST /api/auth/login
 *
 * Thin controller: validates request shape, delegates to the service,
 * shapes the HTTP response. All auth logic (hashing, token generation,
 * enumeration defenses) lives in authService.
 */
async function login(req, res, next) {
  try {
    // `|| {}` guards against a missing body. `express.json()` sets
    // `req.body = {}` for empty bodies, but a request without
    // Content-Type leaves it `undefined` — destructuring would then
    // throw instead of producing a clean 400.
    const { email, password } = req.body || {};

    // Type + non-empty validation. Only checks the *shape* of input —
    // the schema-level (format) and business-level (right password)
    // rules are the service's job. Doing it here means the service
    // can assume non-empty strings and stay focused.
    // `!password` catches both "" and undefined — no `.trim()` needed
    // since whitespace passwords are valid (if unusual).
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      throw new AppError(
        "Email and password are required",
        400,
        "VALIDATION_ERROR",
      );
    }

    // Service throws AppError on any auth failure (401). We never
    // branch on the result — success here means fully authenticated.
    const result = await authService.login({
      email,
      password,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    // Hand to the global errorHandler. Without this, Express would
    // treat the async rejection as an unhandled promise and leave
    // the client hanging.
    next(error);
  }
}

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user's profile. Assumes `req.user` was
 * populated by the auth middleware (JWT verification) — this
 * controller never parses the token itself.
 */
async function getCurrentUser(req, res, next) {
  try {
    // Trusting `req.user.id` here is safe ONLY because the auth
    // middleware ran first. If this route is ever wired without that
    // middleware, `req.user` is undefined → TypeError → 500. That's a
    // routing bug, not a controller bug — but worth knowing.
    const user = await authService.getCurrentUser(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  getCurrentUser,
};
