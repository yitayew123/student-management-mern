const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Single field by design — matches how the UI collects the name.
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    // Email is the login identifier. Note: `unique` is deliberately NOT
    // set on the field — uniqueness is enforced solely by the named
    // index at the bottom of the file. Keeping it in one place avoids
    // two index definitions with different names fighting each other.
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true, // normalize so Foo@x.com == foo@x.com
      trim: true,
      maxlength: 254, // RFC 5321 upper bound
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    // Only the bcrypt hash is stored — never the plaintext password.
    // `select: false` excludes this field from every query by default,
    // so it can't leak through a normal find()/populate(). Must be
    // requested explicitly (`.select("+passwordHash")`) for login.
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false,
    },

    // Role is a fixed enum to prevent typos ("Admin", "STUDENT") from
    // creating unintended privilege states. Defaults to least privilege.
    role: {
      type: String,
      enum: ["admin", "instructor", "student"],
      default: "student",
      required: true,
    },

    // Soft-disable accounts without deleting them — preserves related
    // records (enrollments, audit trails). `required` is explicit so a
    // caller can't sneak in `undefined` and bypass the default.
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt
    versionKey: false, // drop __v — no optimistic concurrency in use
  },
);

// Unique index on email, with an explicit stable name.
// The name matters because:
//   - If the index definition ever changes, MongoDB identifies it by
//     name — a stable name avoids "duplicate index" or "index not found"
//     errors during migrations.
//   - Logs and `db.users.getIndexes()` output are far more readable.
// This index is what actually enforces uniqueness — the field-level
// `unique` hint was intentionally removed to have a single source of truth.
userSchema.index(
  { email: 1 },
  {
    unique: true,
    name: "unique_user_email",
  },
);

module.exports = mongoose.model("User", userSchema);
