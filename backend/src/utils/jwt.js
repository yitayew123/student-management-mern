const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

/**
 * Create a signed access token for an authenticated user.
 *
 * The payload is intentionally minimal — only `role` (for quick
 * authorization checks) plus standard claims. Sensitive or frequently
 * changing data (email, name, permissions) should NOT go in here:
 * JWTs are base64-decoded, not encrypted — anyone with the token can
 * read the payload.
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      // Only the role travels in the token. Everything else is
      // re-fetched from the DB when needed.
      role: user.role,
    },
    env.JWT_SECRET,
    {
      // Standard JWT claims. Using the options object (rather than
      // putting these in the payload) lets jsonwebtoken apply the
      // correct defaults and validation rules automatically.

      // `sub` is the canonical claim for "who this token is about".
      // toString() because _id is an ObjectId, not a string — JWTs
      // require string values.
      subject: user._id.toString(),

      // Expiry: relative like "15m" / "1d". Short-lived access tokens
      // limit the damage window if a token is stolen.
      expiresIn: env.JWT_EXPIRES_IN,

      // `iss` / `aud` pin the token to this API and this frontend.
      // Verification below rejects tokens minted by another service
      // or intended for a different client — important defense if
      // the same secret is ever reused across systems.
      issuer: "student-management-api",
      audience: "student-management-frontend",

      // Explicit algorithm avoids the classic "alg: none" attack
      // and prevents an attacker from forcing a different algorithm
      // (e.g., RS256 → HS256 confusion).
      algorithm: "HS256",
    },
  );
}

/**
 * Verify the signature and standard claims of an access token.
 *
 * Throws on any failure (bad signature, expired, wrong issuer/audience,
 * wrong algorithm). Callers should catch and translate to an AppError.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    // Verify the same iss/aud we set at sign time — a token from
    // elsewhere will be rejected even if the signature is valid
    // (relevant when the same secret is shared across services).
    issuer: "student-management-api",
    audience: "student-management-frontend",

    // Whitelist the algorithm. Passing an array (vs. a string) is the
    // recommended form and is what blocks algorithm-confusion attacks.
    algorithms: ["HS256"],
  });
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
};
