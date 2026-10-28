const { z } = require("zod");

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId.");

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(254)
  .transform((v) => v.toLowerCase());

const nameSchema = z.string().trim().min(2).max(100);

// bcrypt truncates passwords at 72 bytes. Enforce both bounds
// explicitly so users don't paste a 100-char password and get a
// silently-truncated hash.
const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(72, "Password must not exceed 72 characters.");

// Only instructors and students can be created via API. Admins
// are seeded via the CLI script (one-time setup) — allowing API
// creation of admins would be a privilege-escalation vector if
// the admin-only gate ever regressed.
const createUserSchema = z
  .object({
    fullName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(["instructor", "student"]),
  })
  .strict();

const listUsersQuerySchema = z
  .object({
    role: z.enum(["admin", "instructor", "student"]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    search: z.string().trim().max(100).optional().default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z
      .enum(["fullName", "email", "role", "createdAt"])
      .default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

const changeUserStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

const userIdSchema = objectId;

module.exports = {
  createUserSchema,
  listUsersQuerySchema,
  changeUserStatusSchema,
  userIdSchema,
};
