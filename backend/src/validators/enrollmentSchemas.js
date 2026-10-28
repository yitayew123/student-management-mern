const { z } = require("zod");

// Reusable ObjectId validator — used for the student/course refs,
// the enrollment `:id` path param, and every ObjectId query filter.
// The alias `enrollmentIdSchema` at the bottom gives this a clear
// name at call sites in the controller.
const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid MongoDB ID.");

// Full lifecycle enum — mirrors the model's `status` field.
// Only `cancelEnrollmentSchema` exposes a narrow slice of this;
// other transitions (complete/drop/withdraw) don't yet have
// dedicated endpoints. Add them here as you add the handlers.
const enrollmentStatusSchema = z.enum([
  "enrolled",
  "completed",
  "cancelled",
  "dropped",
  "withdrawn",
]);

// ─── Create (POST body) ────────────────────────────────────────
// ✅ FIXED: `academicYear` and `semester` are now part of the create
// payload. Without them the Enrollment model rejects the write with
// "Academic year is required" — and `.strict()` would have blocked
// them from being sent, so no request shape worked.
//
// Both fields match the model's bounds (academicYear: 20 chars,
// semester: 30 chars). `min(4)` on academicYear is a light sanity
// check for formats like "2024" or "2026/2027" — it's not enforced
// by the model, but catches obvious typos like "26".
const createEnrollmentSchema = z
  .object({
    student: objectIdSchema,
    course: objectIdSchema,
    academicYear: z.string().trim().min(4).max(20),
    semester: z.string().trim().min(1).max(30),
  })
  .strict();

// ─── Cancel (dedicated endpoint body) ──────────────────────────
// Deliberately narrow: only a free-text reason. The status is
// implied by the endpoint (`PATCH /:id/cancel` sets status to
// "cancelled"). "Cancel" is a domain action with side effects
// (audit trail + capacity release), not just a field edit — so it
// gets its own endpoint instead of a generic status PATCH.
//
// `.optional().default("")` — cancelling without a reason is
// allowed, but the field is always present (as "") in the parsed
// output, so the service can pass it directly to `$set` without a
// null check.
const cancelEnrollmentSchema = z
  .object({
    reason: z.string().trim().max(500).optional().default(""),
  })
  .strict();

// ─── List (GET query string) ───────────────────────────────────
// Query params arrive as strings — numeric fields use z.coerce.
// `sortBy`/`order` enums are whitelists (NoSQL injection defense).
// `.strict()` rejects typos like `?limt=10` — deliberate trade-off:
// adding a new param requires updating this file.
//
// ✅ ADDED: `academicYear` + `semester` filters. Without them you
// couldn't answer "show me Fall 2025 enrollments" — the exact query
// the term fields exist to support. Matches `listCoursesQuerySchema`.
const listEnrollmentsQuerySchema = z
  .object({
    student: objectIdSchema.optional(),
    course: objectIdSchema.optional(),
    status: enrollmentStatusSchema.optional(),
    academicYear: z.string().trim().max(20).optional(),
    semester: z.string().trim().max(30).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),

    // max(100) caps page size — one-line DB-DoS mitigation.
    limit: z.coerce.number().int().min(1).max(100).default(10),

    // Whitelisted sort fields. `enrolledAt`, `createdAt`, `status`
    // all have index coverage; `updatedAt` does not — sorting by
    // it will scan. If that becomes a problem, add an index or
    // remove "updatedAt" from this list.
    sortBy: z
      .enum(["enrolledAt", "createdAt", "updatedAt", "status"])
      .default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

// Alias for readability in controllers: `enrollmentIdSchema` reads
// better than `objectIdSchema` at the call site. Functionally identical.
const enrollmentIdSchema = objectIdSchema;

module.exports = {
  createEnrollmentSchema,
  cancelEnrollmentSchema,
  listEnrollmentsQuerySchema,
  enrollmentIdSchema,
};
