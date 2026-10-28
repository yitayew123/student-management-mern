const RolePermission = require("../models/RolePermission");
const AppError = require("../utils/AppError");
const {
  PERMISSION_GROUPS,
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} = require("../config/permissions");

const ROLES = ["admin", "instructor", "student"];

async function getRolePermissions() {
  const docs = await RolePermission.find().lean();

  // Ensure every role has an entry — even if the seed script wasn't run.
  const byRole = new Map(docs.map((d) => [d.role, d.permissions]));

  return ROLES.reduce((acc, role) => {
    acc[role] = byRole.get(role) ?? DEFAULT_ROLE_PERMISSIONS[role] ?? [];
    return acc;
  }, {});
}

async function updateRolePermissions(role, permissions, actorId) {
  if (!ROLES.includes(role)) {
    throw new AppError("Invalid role.", 400, "INVALID_ROLE");
  }

  // Self-lockout guard: an admin changing their own role's permissions
  // could accidentally revoke `role_permissions.update` and be locked
  // out of the settings page forever (only fixable via DB access).
  if (role === "admin" && !permissions.includes("role_permissions.update")) {
    throw new AppError(
      "The admin role must retain the `role_permissions.update` permission to prevent lockout.",
      400,
      "CANNOT_REVOKE_SELF_LOCKOUT",
    );
  }

  // Also ensure the admin role always retains at least one way to
  // manage users — otherwise the app becomes admin-less.
  if (role === "admin" && !permissions.includes("users.create")) {
    throw new AppError(
      "The admin role must retain the `users.create` permission.",
      400,
      "CANNOT_REVOKE_USER_MANAGEMENT",
    );
  }

  const doc = await RolePermission.findOneAndUpdate(
    { role },
    { $set: { permissions, updatedBy: actorId } },
    { new: true, upsert: true, runValidators: true },
  ).lean();

  return doc;
}

/** Full catalog for the admin UI (grouped for display). */
function getCatalog() {
  return {
    groups: PERMISSION_GROUPS,
    descriptions: PERMISSIONS,
    roles: ROLES,
  };
}

module.exports = {
  getRolePermissions,
  updateRolePermissions,
  getCatalog,
};
