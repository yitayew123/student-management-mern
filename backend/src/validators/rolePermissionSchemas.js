const { z } = require("zod");
const { PERMISSIONS } = require("../config/permissions");

const validKeys = Object.keys(PERMISSIONS);

const updateRolePermissionsSchema = z
  .object({
    permissions: z
      .array(z.enum(validKeys))
      .max(validKeys.length)
      // Reject duplicates silently (dedupe) rather than failing
      .transform((arr) => Array.from(new Set(arr))),
  })
  .strict();

const roleParamSchema = z.enum(["admin", "instructor", "student"]);

module.exports = {
  updateRolePermissionsSchema,
  roleParamSchema,
};
