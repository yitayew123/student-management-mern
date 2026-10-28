const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    // ── Links to core entities ──────────────────────────────
    // `index: false` is explicit documentation of intent:
    // standalone single-field indexes on these would be redundant
    // because the compound indexes below include them as prefixes.
    // Without it, a future contributor adding `index: true` on
    // `student` (e.g., for autocomplete) creates a duplicate index.
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student reference is required"],
      index: false,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
      index: false,
    },

    // ── Term context ────────────────────────────────────────
    // Lives on the enrollment (not the Course) because the same
    // course runs across multiple terms — each offering is a
    // distinct enrollment context. **Essential**: without these,
    // a student could only ever enroll in CS101 once, ever.
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
      maxlength: 20,
    },

    semester: {
      type: String,
      required: [true, "Semester is required"],
      trim: true,
      maxlength: 30,
    },

    // ── Timestamps ──────────────────────────────────────────
    // Set to "now" by default but overridable — for backfilling
    // historical records or bulk imports where the enrollment
    // actually happened on a past date.
    enrolledAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // ── Lifecycle ───────────────────────────────────────────
    //   enrolled  → currently taking the course
    //   completed → finished; grade should be set
    //   cancelled → administrative cancellation (university cancelled
    //               the offering, or explicit admin action) — distinct
    //               from a student choosing to drop
    //   dropped   → student dropped early, typically no grade impact
    //   withdrawn → withdrew after the drop window
    //
    // Keeping `cancelled` and `dropped` separate enables correct
    // reporting: "how many courses did we cancel this term?" is a
    // different question from "how many students dropped out?"
    status: {
      type: String,
      enum: ["enrolled", "completed", "cancelled", "dropped", "withdrawn"],
      required: true,
      default: "enrolled",
    },

    // ── Cancellation audit trail ────────────────────────────
    // All three are null/empty unless status === "cancelled". The
    // service layer is responsible for the "if cancelled, set these"
    // rule — Mongoose validators can't express cross-field lifecycle
    // constraints cleanly without custom validators that break partial
    // updates.
    //
    // Using `null` for the dates/refs (queryable) and `""` for the
    // free-text reason (renders without null-checks in UI text fields).
    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    // ── Grade ───────────────────────────────────────────────
    // Nullable by design: null means "not graded yet". Only
    // meaningful once status === "completed" — that pairing is
    // enforced in the service layer (schema validators can't
    // express cross-field lifecycle rules cleanly).
    //
    // Uppercase keeps grades consistent ("a" → "A"); maxlength 5
    // accommodates formats like "A+" or "100".
    grade: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 5,
      default: null,
    },

    // ── Creation audit ──────────────────────────────────────
    // Who created this enrollment — useful when the request is
    // triggered by an admin/instructor on behalf of a student
    // (or a self-service enrollment). Null when seeded/imported
    // by a system process (no authenticated user).
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ─── Indexes ────────────────────────────────────────────────────
// Every index below maps to a real query pattern. Each one costs
// write throughput — don't add more without a matching use case.

// ── CRITICAL: unique active enrollment per course per term ─────
// A student may have historical records for the same course/term
// (dropped, completed, cancelled, withdrawn) — the
// `partialFilterExpression` exempts those from the uniqueness rule.
//
// The compound key includes academicYear + semester so a student
// can be enrolled in CS101 for "Fall 2025" AND "Spring 2026" as
// two separate active records — the correct behavior for per-term
// tracking.
//
// Why both parts matter:
//   - Without partialFilterExpression: can't keep a "dropped" record
//     AND a new "enrolled" record for the same course/term.
//   - Without term fields: student could only enroll in CS101 once,
//     ever — re-enrollment in a new term is silently impossible.
//
// This index is what makes `createEnrollment` bulletproof: even if
// the app-layer duplicate check races under concurrency, the DB
// rejects the second insert with E11000.
enrollmentSchema.index(
  {
    student: 1,
    course: 1,
    academicYear: 1,
    semester: 1,
  },
  {
    unique: true,
    partialFilterExpression: { status: "enrolled" },
    name: "unique_active_enrollment",
  },
);

// ── Course roster ──────────────────────────────────────────────
// "Show me active students in CS301" (instructor view) and
// "list all enrollments for CS301 sorted newest first" (admin view).
// Prefix `course: 1` also serves filter-only queries.
enrollmentSchema.index({ course: 1, status: 1, createdAt: -1 });

// ── Student history ────────────────────────────────────────────
// "My active enrollments" (student dashboard) and "my full
// enrollment history" (student profile). Prefix `student: 1`
// serves both filtered (with status) and unfiltered queries.
enrollmentSchema.index({ student: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
