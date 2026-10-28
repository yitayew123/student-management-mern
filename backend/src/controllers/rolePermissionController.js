const AppError = require("../utils/AppError");
const rolePermissionService = require("../services/rolePermissionService");
const {
  updateRolePermissionsSchema,
  roleParamSchema,
} = require("../validators/rolePermissionSchemas");

function validate(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const error = new AppError(
      "Request validation failed.",
      400,
      "VALIDATION_ERROR",
    );
    error.details = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw error;
  }
  return result.data;
}

function success(res, code, message, data) {
  return res.status(code).json({ success: true, message, data });
}

/** GET /api/admin/role-permissions — current policy + catalog. */
async function get(req, res, next) {
  try {
    const [policy, catalog] = await Promise.all([
      rolePermissionService.getRolePermissions(),
      Promise.resolve(rolePermissionService.getCatalog()),
    ]);
    return success(res, 200, "Role permissions retrieved.", {
      policy,
      catalog,
    });
  } catch (error) {
    return next(error);
  }
}

/** PATCH /api/admin/role-permissions/:role — update a single role. */
async function update(req, res, next) {
  try {
    const role = validate(roleParamSchema, req.params.role);
    const { permissions } = validate(updateRolePermissionsSchema, req.body);
    const result = await rolePermissionService.updateRolePermissions(
      role,
      permissions,
      req.user.id,
    );
    return success(res, 200, `Permissions updated for ${role}.`, {
      role,
      permissions: result.permissions,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { get, update };
