const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    // ── KEEP: studentId (not studentNumber) ─────────────────────
    // Existing code, seed script, tests, and Enrollment consumers
    // all reference `studentId`. Renaming is a breaking change with
    // no functional benefit — keep the name.
    //
    // ADOPT from new: none. (Its minlength:2 is *weaker* than yours;
    // keep minlength:3.)
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 3,             // KEEP — stricter than the new version
      maxlength: 30,
    },

    // ── ADOPT: name bounds 1–80 ────────────────────────────────
    // The new version is correct here: min 1 allows real single-
    // character names (e.g. "李"), max 80 is fine. Your 2/50 rejects
    // valid names.
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: 1,             // ADOPT (was 2)
      maxlength: 80,            // ADOPT (was 50)
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: 1,             // ADOPT (was 2)
      maxlength: 80,            // ADOPT (was 50)
    },

    // ── KEEP: email NOT unique ─────────────────────────────────
    // Design decision from Phase 6 stands: contact emails may be
    // shared (guardians) or duplicated (legacy imports). The login
    // email lives on the linked User document.
    // The new version's `unique: true` reverses this — SKIP it.
    email: {
      type: String,
      required: [true, "Student email is required"],
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    // ── KEEP: null default (not "") ────────────────────────────
    // Your schema uses `null` for "unknown" consistently. Switching
    // only phone to "" would be inconsistent. Pick one convention —
    // null — and stick to it.
    phone: {
      type: String,
      trim: true,
      maxlength: 25,
      default: null,
    },

    // ── KEEP: these fields exist ───────────────────────────────
    // The new version drops dateOfBirth and gender. Dropping them
    // means any code that writes them silently drops the data
    // (Mongoose strips unknown fields by default). Keep both.
    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },

    // ── KEEP: optional with null default ───────────────────────
    // The new version makes these required. That reverses the
    // Phase 6 design ("create before all data is known") and will
    // break bulk imports and quick-add flows. Keep optional.
    // If your product truly requires them, enforce in the
    // controller/service layer — not at the schema level.
    department: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    program: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    yearLevel: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "graduated", "suspended"],
      default: "active",
      required: true,
    },

    // ── KEEP: user link ────────────────────────────────────────
    // The single most important field to preserve. Without it:
    //   - student ↔ login auth breaks
    //   - /api/auth/me has no Student to load
    //   - any user-scoped student lookup needs email-matching hacks
    // The new version dropped this — a serious regression. Keep it.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes (merged) ─────────────────────────────────────────

// KEEP: unique lookup by business ID.
// studentSchema.index({ studentId: 1 }, { unique: true });

// KEEP: non-unique email index — search/lookup only.
studentSchema.index({ email: 1 });

// KEEP: compound name index — matches sort/lookup by last name.
studentSchema.index({ lastName: 1, firstName: 1 });

// ADOPT: replace `{ status: 1 }` with `{ status: 1, createdAt: -1 }`.
// The compound serves both `{ status }` queries (status is first
// field) AND "latest active students first" list views, which is
// almost certainly what your admin dashboard wants.
studentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Student", studentSchema);