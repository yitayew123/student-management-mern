const User = require("../models/User");
const RolePermission = require("../models/RolePermission");
const AppError = require("../utils/AppError");
const { verifyAccessToken } = require("../utils/jwt");
const { DEFAULT_ROLE_PERMISSIONS } = require("../config/permissions");

/**
 * Authentication middleware.
 *
 * Expects `Authorization: Bearer <token>`. On success populates
 * `req.user = { id, email, role, permissions }` and calls next(). On
 * any failure forwards a 401 AppError to the global error handler.
 *
 * Every failure path uses the SAME 401 error family so an attacker
 * can't distinguish "no token" from "expired token" from "banned
 * user" by the response alone.
 *
 * Permissions are loaded from the RolePermission collection on every
 * request — see "why the extra lookup" below.
 */
async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    // Reject anything that isn't exactly "Bearer <token>".
    // This automatically excludes Basic, Digest, and empty headers —
    // the middleware only handles one scheme, and mixing schemes in
    // one middleware invites subtle auth bugs.
    if (
      typeof authorization !== "string" ||
      !authorization.startsWith("Bearer ")
    ) {
      throw new AppError(
        "Authentication required",
        401,
        "AUTHENTICATION_REQUIRED",
      );
    }

    // Slice off the "Bearer " prefix (7 chars), then trim to tolerate
    // trailing whitespace from sloppy clients. Empty string after this
    // means a header like "Bearer " with nothing after — reject it
    // before wasting a jwt.verify() call.
    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      throw new AppError(
        "Authentication required",
        401,
        "AUTHENTICATION_REQUIRED",
      );
    }

    // ── Inner try/catch ─────────────────────────────────────────
    // jwt.verify throws on any failure: bad signature, expired,
    // wrong issuer/audience, algorithm mismatch. We collapse every
    // reason into one generic message — leaking "token expired" vs
    // "bad signature" helps an attacker probe.
    //
    // Note: this also swallows programmer errors (e.g., TypeError
    // from a malformed token object). Acceptable trade-off here
    // because the outer catch would turn those into 500s anyway —
    // and a 500 on auth is worse than a 401.
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(
        "Invalid or expired access token",
        401,
        "INVALID_ACCESS_TOKEN",
      );
    }

    // Defensive shape check on the payload. jwt.verify() returns
    // whatever was signed — if a buggy or malicious issuer ever
    // signed `{ sub: 42 }`, `payload.sub` would be a number and
    // User.findById() would throw. This closes that gap and keeps
    // the controller contract ("req.user.id is a string") honest.
    if (typeof payload !== "object" || typeof payload.sub !== "string") {
      throw new AppError(
        "Invalid or expired access token",
        401,
        "INVALID_ACCESS_TOKEN",
      );
    }

    // DB lookup on every request — deliberate trade-off:
    //   + Revocation works (deactivated users get locked out immediately)
    //   + Role changes take effect instantly (see note below)
    //   − Costs one DB round-trip per request
    // A cache (e.g., 30s TTL on {id → isActive, role}) would reduce
    // load at the cost of slight staleness — worth adding only if
    // latency becomes a real problem.
    const user = await User.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new AppError(
        "Authentication required",
        401,
        "AUTHENTICATION_REQUIRED",
      );
    }

    // ── Load this role's permissions ────────────────────────────
    // Permissions are stored in the RolePermission collection, not
    // baked into the JWT. Reasons:
    //   1. An admin can revoke a permission and the change takes
    //      effect on the user's NEXT request — no waiting for the
    //      token to expire. (Same revocation model as isActive.)
    //   2. The JWT payload stays small — no need to embed ~20
    //      permission strings per token.
    //   3. Permission config is a first-class DB resource, not a
    //      hardcoded constant.
    //
    // Fallback chain:
    //   RolePermission doc (if seeded and possibly edited)
    //   → DEFAULT_ROLE_PERMISSIONS (if the doc is missing — e.g.,
    //     seed script not run yet)
    //   → empty array (unknown role — shouldn't happen; fails safe)
    //
    // This adds one extra DB round-trip per request. Two queries
    // total (User.findById + RolePermission.findOne) is fine for a
    // small user base. Optimization for later: cache role → permissions
    // in a module-level Map with 30s TTL, invalidate on updates.
    const rolePermission = await RolePermission.findOne({
      role: user.role,
    }).lean();

    const permissions =
      rolePermission?.permissions ?? DEFAULT_ROLE_PERMISSIONS[user.role] ?? [];

    // ── Critical: use DB values, NOT JWT values ─────────────────
    // The JWT payload contains a `role`, but it may be stale (the
    // user could have been demoted since the token was issued).
    // Using `payload.role` here would let a demoted admin retain
    // admin privileges until the token expires — a real privilege
    // escalation risk. The DB is the source of truth for authz.
    //
    // Same for permissions: the JWT could carry an old snapshot,
    // but the DB is authoritative. If we ever embed permissions in
    // the token for optimization, we'd still re-check the DB for
    // destructive operations (defense in depth).
    //
    // `_id.toString()` keeps `req.user.id` a plain string, matching
    // what controllers/services expect (no ObjectId leaking into
    // serialized responses or equality checks).
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      permissions,
    };

    next();
  } catch (error) {
    // Forward to the global error handler. Returning here is not
    // required (nothing follows), but the pattern matters: after
    // next(error), Express has moved on — do nothing else.
    next(error);
  }
}

module.exports = authenticate;
