const { z } = require("zod");

// ─── Reusable primitives ────────────────────────────────────────
// Shared field schemas — a change here propagates everywhere.

// Course lifecycle status. Single source of truth for allowed
// states — reused by create, the status-change endpoint, and list
// filtering, so a value added here (say, "draft") is accepted by
// all three without drift.
const courseStatusSchema = z.enum(["active", "inactive", "archived"]);

// Business ID (e.g., "CS101"). Uppercase-normalized to match the
// model's `uppercase: true` — otherwise "cs101" and "CS101" would
// be treated as different courses by the unique index.
// Length bounds mirror the model exactly (2–30).
const courseCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .transform((value) => value.toUpperCase());

const courseTitleSchema = z.string().trim().min(2).max(150);

// Instructor must be a valid ObjectId OR explicitly null.
// The union (not `.nullable()`) is deliberate — it rejects any
// non-ObjectId string, so a typo like `instructor: "prof-smith"`
// fails with a clear 400 instead of crashing Mongoose later with
// a CastError.
const instructorSchema = z.union([
  z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid instructor ID."),
  z.null(),
]);

// ─── Create (POST body) ────────────────────────────────────────
// `.strict()` rejects unknown keys — mass-assignment defense.
// Field-by-field, this mirrors the model exactly:
//   required here  ↔  `required: true` in the schema
//   optional here  ↔  `default: ...` in the schema
const createCourseSchema = z
  .object({
    courseCode: courseCodeSchema,
    title: courseTitleSchema,

    // ✅ Matches model's `default: ""` — an empty description is
    // valid, and the stored value is always a string.
    description: z.string().trim().max(2000).optional().default(""),

    department: z.string().trim().min(2).max(100),
    credits: z.coerce.number().int().min(1).max(30),

    // ⚠️ `.optional().default(null)` combined with a union that
    // already accepts null is slightly redundant but correct:
    //   - omitted        → `.default(null)` fills in → null
    //   - explicit null  → union accepts → null
    //   - valid ObjectId → union accepts → string
    //   - invalid string → union rejects → 400
    // Could simplify to just `.default(null)` — `.optional()` is
    // implied by `.default()` in Zod. Not a bug, just a nit.
    instructor: instructorSchema.optional().default(null),

    semester: z.string().trim().min(1).max(50),

    // ⚠️ min(4) is STRICTER than the model (which has no minlength).
    // A value like "24" would save via the model but fail here.
    // Intentional for realistic formats ("2024", "2024-25") — but
    // worth knowing if any downstream tool ever sends 2-digit years.
    academicYear: z.string().trim().min(4).max(20),

    capacity: z.coerce.number().int().min(1).max(10000).default(30),
    status: courseStatusSchema.optional().default("active"),
  })
  .strict();

// ─── Update (PATCH body) ───────────────────────────────────────
// Every field is `.optional()` — partial updates are the point.
// `.refine()` requires ≥ 1 field: otherwise an empty body would
// silently pass and produce a no-op update (confusing 200 OK).
//
// `status` is absent on purpose — status changes have their own
// endpoint (changeCourseStatusSchema) so future side effects
// (audit log, capacity recalculation) live in one place.
//
// Note: `description` here is `.optional()` only — not
// `.nullable()`. You can omit it to keep the current value, or
// set it to "" to clear, but cannot set it to null. That matches
// the model's `default: ""` (never null in the DB).
const updateCourseSchema = z
  .object({
    courseCode: courseCodeSchema.optional(),
    title: courseTitleSchema.optional(),
    description: z.string().trim().max(2000).optional(),
    department: z.string().trim().min(2).max(100).optional(),
    credits: z.coerce.number().int().min(1).max(30).optional(),
    instructor: instructorSchema.optional(),
    semester: z.string().trim().min(1).max(50).optional(),
    academicYear: z.string().trim().min(4).max(20).optional(),
    capacity: z.coerce.number().int().min(1).max(10000).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

// ─── Status change (dedicated endpoint) ────────────────────────
// Only `status` accepted — `.strict()` blocks any other field
// from being smuggled in alongside a status change.
const changeCourseStatusSchema = z
  .object({
    status: courseStatusSchema,
  })
  .strict();

// ─── Route param (MongoDB ObjectId) ────────────────────────────
// Validates the `:id` path parameter before it reaches Mongoose.
// Without it, a malformed id would cause a CastError → 500.
// With it, the client gets a clean 400.
//
// Clean naming (unlike Student, where the business field and
// ObjectId both read as "studentId"): here `courseCode` is the
// business field, `courseId` is unambiguously the ObjectId param.
const courseIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid course ID.");

// ─── Query-string validation (GET /courses) ────────────────────
// Query params arrive as strings — numeric fields use z.coerce.
// The `sortBy`/`order` enums are whitelists; without them,
// `sortBy=passwordHash` could probe sensitive fields via response
// ordering.
//
// ⚠️ `.strict()` on a query schema is unusual but deliberate —
// typos like `?limt=10` return 400 instead of being silently
// ignored. Trade-off: adding a new param requires updating this
// file, or the client request fails.
const listCoursesQuerySchema = z
  .object({
    search: z.string().trim().max(100).default(""),
    department: z.string().trim().max(100).optional(),
    status: courseStatusSchema.optional(),
    semester: z.string().trim().max(50).optional(),
    academicYear: z.string().trim().max(20).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z
      .enum([
        "courseCode",
        "title",
        "department",
        "credits",
        // ⚠️ `capacity` has no index in the model — sorting by it
        // forces a full collection scan. If this sort matters at
        // scale, add `courseSchema.index({ capacity: 1 })` or
        // drop it from the enum.
        "capacity",
        "semester",
        "academicYear",
        "status",
        "createdAt",
      ])
      .default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

module.exports = {
  createCourseSchema,
  updateCourseSchema,
  changeCourseStatusSchema,
  courseIdSchema,
  listCoursesQuerySchema,
};
