const { z } = require("zod");

// ─── Reusable primitives ────────────────────────────────────────
// Shared field schemas — a change here propagates everywhere.

// Business ID (e.g., "STU-2026-001"). Uppercase normalized to match
// the model's `uppercase: true`. min(3) and max(30) match the model
// exactly (previous version had min(2), which was weaker).
//
// ⚠️ RENAMED from `studentNumber` → `studentId` to match the model.
// The path-parameter validator below is a *different* thing (MongoDB
// `_id`) — see the naming warning near `studentIdSchema`.
const studentId = z
  .string()
  .trim()
  .min(3, "Student ID must be at least 3 characters")
  .max(30)
  .transform((value) => value.toUpperCase());

// Lowercase-normalized email — mirrors the model's `lowercase: true`.
// Format only; uniqueness is the DB's job (and email is NOT unique
// in this model — see Student.js).
const email = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(254)
  .transform((value) => value.toLowerCase());

// min 1 accepts single-character names; max 80 covers international.
const personName = z.string().trim().min(1).max(80);

// Optional text field, matching the model's `default: null`.
// `.nullable()` allows explicit null (clear the field);
// `.optional()` allows omitting it entirely.
// Both paths produce the same stored value: null.
const nullableText = (max) => z.string().trim().max(max).nullable().optional();

// ─── Create (POST body) ────────────────────────────────────────
// `.strict()` rejects unknown keys — prevents mass-assignment
// (a client sending `role: "admin"` alongside valid fields).
//
// Required: studentId, firstName, lastName, email.
// Optional: everything else (matches the model's `default: null`).
const createStudentSchema = z
  .object({
    studentId,
    firstName: personName,
    lastName: personName,
    email,

    // ✅ FIXED: was `.optional().default("")`. Now matches the model's
    // `default: null`. Stored value is null when omitted or explicitly
    // null — queries like `{ phone: null }` work as expected.
    phone: nullableText(25),

    // ✅ NEW: model has these fields, validators didn't. Without them,
    // attempts to set dateOfBirth/gender would be rejected by `.strict()`
    // as unknown keys.
    dateOfBirth: z.coerce.date().nullable().optional(),
    gender: z
      .enum(["male", "female", "other", "prefer_not_to_say"])
      .optional()
      .default("prefer_not_to_say"),

    // ✅ FIXED: were `.min(1)` required. Model has them as optional
    // (default null). Reversing back to optional — matches the model's
    // "create before all data is known" design.
    department: nullableText(100),
    program: nullableText(100),

    // ✅ FIXED: was required. Model allows null. Now `.nullable().optional()`.
    yearLevel: z.coerce.number().int().min(1).max(10).nullable().optional(),

    // Optional, defaults to "active". Enum repeated here and in the
    // model — defense in depth (Zod → 400, model → last line of defense).
    status: z
      .enum(["active", "inactive", "graduated", "suspended"])
      .optional()
      .default("active"),
  })
  .strict();

// ─── Update (PATCH body) ───────────────────────────────────────
// Every field is `.optional()` — partial updates are the point.
// `.refine()` requires ≥ 1 field: otherwise an empty body would
// silently pass and produce a no-op update (confusing 200 OK).
//
// Note: `status` is absent — status has its own endpoint
// (changeStatusSchema below), because transitions trigger side effects.
const updateStudentSchema = z
  .object({
    studentId: studentId.optional(),
    firstName: personName.optional(),
    lastName: personName.optional(),
    email: email.optional(),
    phone: nullableText(25),
    dateOfBirth: z.coerce.date().nullable().optional(),
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
    department: nullableText(100),
    program: nullableText(100),
    yearLevel: z.coerce.number().int().min(1).max(10).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

// ─── Status change (dedicated endpoint) ────────────────────────
// Only `status` is accepted — `.strict()` blocks any other field
// from being smuggled in alongside a status change.
const changeStatusSchema = z
  .object({
    status: z.enum(["active", "inactive", "graduated", "suspended"]),
  })
  .strict();

// ─── Route param (MongoDB ObjectId) ────────────────────────────
// Validates the `:id` path parameter before it reaches Mongoose.
// Without it, a malformed ID causes a CastError → 500. With it,
// the client gets a clean 400.
//
// ⚠️ NAMING COLLISION: `studentIdSchema` here validates the Mongo
// ObjectId (24 hex chars). The BUSINESS ID field is now also called
// `studentId` (above). These are two different things that happen
// to share a name — easy to confuse in code review.
//
// Consider renaming this to `mongoIdSchema` (and updating the
// controller import), which would eliminate the ambiguity:
//   const mongoIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid student ID");
const studentIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid student ID");

// ─── Query-string validation (GET /students) ───────────────────
// Query params arrive as strings — every numeric field uses
// z.coerce. The `sortBy`/`order` enums are whitelists; without
// them, `sortBy=passwordHash` could probe sensitive fields.
const listStudentsQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional().default(""),
    status: z.enum(["active", "inactive", "graduated", "suspended"]).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),

    // ✅ FIXED: `"studentNumber"` → `"studentId"` to match the model.
    // Sorting by a non-existent field would silently return
    // unsorted results — a subtle bug that's hard to notice.
    sortBy: z
      .enum([
        "studentId",
        "firstName",
        "lastName",
        "email",
        "department",
        "yearLevel",
        "status",
        "createdAt",
      ])
      .optional()
      .default("createdAt"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .strict();

module.exports = {
  createStudentSchema,
  updateStudentSchema,
  changeStatusSchema,
  studentIdSchema,
  listStudentsQuerySchema,
};
