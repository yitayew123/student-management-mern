const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    // Human-facing course identifier (e.g., "CS101", "MATH-201").
    // Uppercase normalization matches Student.studentId's pattern —
    // "cs101" and "CS101" must collide on the unique index. Note:
    // `unique` is NOT on the field — it's declared as the named
    // index below. Two index definitions would trigger Mongoose's
    // "duplicate schema index" warning (as happened on Student).
    courseCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 30,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    // Optional with a "" default (not null) — courses render fine
    // in the UI without a description and the field is always a
    // string. Consistent with the earlier Course design.
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // Plain string (not a ref) — departments exist independently
    // of any Department collection. Simple, stable, and prevents
    // coupling to a collection that may not exist yet.
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // Bounded 1–30: 0-credit is invalid; 30 is well beyond any real
    // course load. Larger values almost always signal a typo.
    credits: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
    },

    // Optional: a course can exist before being staffed (created
    // from a curriculum, assigned to an instructor later). Nullable
    // by design. ⚠️ No index on this field — if you frequently
    // query "my courses" per instructor, add:
    //   courseSchema.index({ instructor: 1 });
    // (was present in the earlier version, missing here).
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ⚠️ REQUIRED (was optional in the earlier model). Reverses the
    // "create before all data is known" tolerance — every course
    // must now have both semester and academicYear at creation.
    // If any workflow relies on partial onboarding, this breaks it.
    // Old documents without these fields will fail `save()` on any
    // future update (validator runs on the full doc after $set).
    semester: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    // Also REQUIRED now — same warning as semester above.
    // Stored as string, not date range, because institution formats
    // vary ("2024-25", "Fall 2024", "2024/2025") and enforcing a
    // shape would force a schema migration for every institution.
    academicYear: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    // NEW field vs. earlier version. Caps enrollment — enforced at
    // the application layer (Enrollment service should check this
    // before inserting). Both required + default looks redundant,
    // but they serve different purposes: default fills in when
    // omitted; required blocks explicit `null`/`undefined` override.
    // max 10000 is arbitrary-but-generous — no real course has
    // 10,001 students in one section; this catches obvious typos.
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 10000,
      default: 30,
    },
    //
    enrolledCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Lifecycle states:
    //   active   → currently offered / open for enrollment
    //   inactive → temporarily not offered, kept for history
    //   archived → retired, hidden from normal listings
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      required: true,
    },
  },

  {
    timestamps: true,
    versionKey: false,
  },
);

// ─── Indexes ────────────────────────────────────────────────────
// Every index below maps to a real query pattern — each one costs
// write throughput and disk space. Don't add more casually.

// Unique lookup by course code (also enforces the uniqueness rule
// at the DB level — the only guarantee under concurrency).
courseSchema.index({ courseCode: 1 }, { unique: true });

// Supports "active courses, newest first" — the default admin
// listing. Compound order (status → createdAt) matches the filter
// then sort, so the index serves both clauses.
courseSchema.index({ status: 1, createdAt: -1 });

// Supports "active courses in a department" — the most common
// department-filter view. Field order matters: this serves
// `{ department }` alone and `{ department, status }`, but NOT
// `{ status }` alone (that's served by the previous index).
courseSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model("Course", courseSchema);
