const User = require("../models/User");
const RolePermission = require("../models/RolePermission");
const AppError = require("../utils/AppError");
const { comparePassword } = require("../utils/password");
const { generateAccessToken } = require("../utils/jwt");
const { DEFAULT_ROLE_PERMISSIONS } = require("../config/permissions");

/**
 * Authenticate a user with email and password.
 *
 * On success returns the access token, its metadata, and the user's
 * effective permissions (loaded from the RolePermission config).
 *
 * On failure ALWAYS throws the same `INVALID_CREDENTIALS` error —
 * unknown email, wrong password, and inactive account are
 * indistinguishable to prevent user enumeration.
 */
async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+passwordHash");

  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const accessToken = generateAccessToken(user);

  // ── Load permissions ─────────────────────────────────────────
  // The sidebar and other permission-gated UI need to know what the
  // user can do. Reading from the RolePermission config (with a
  // defaults fallback) keeps a single source of truth: the same data
  // the backend's `requirePermission` middleware uses.
  const rolePermission = await RolePermission.findOne({
    role: user.role,
  }).lean();

  const permissions =
    rolePermission?.permissions ?? DEFAULT_ROLE_PERMISSIONS[user.role] ?? [];

  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn: 86400,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      permissions,
    },
  };
}

/**
 * Return the authenticated user's profile, including their current
 * permissions. Used on page load to restore the session.
 */
async function getCurrentUser(userId) {
  const user = await User.findById(userId);

  if (!user || !user.isActive) {
    throw new AppError(
      "Authentication required",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  // Load the current permissions, rather than relying on an old
  // snapshot stored in the browser or JWT. This is what makes
  // permission changes take effect on the user's next page load.
  const rolePermission = await RolePermission.findOne({
    role: user.role,
  }).lean();

  const permissions =
    rolePermission?.permissions ?? DEFAULT_ROLE_PERMISSIONS[user.role] ?? [];

  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    permissions,
  };
}

module.exports = {
  login,
  getCurrentUser,
};
