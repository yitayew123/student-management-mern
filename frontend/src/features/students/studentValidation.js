/**
 * Client-side validation for the Student form.
 *
 * ⚠️ IMPORTANT — field names must match the backend exactly:
 *   - `studentId`  (NOT `studentNumber`)
 *   - `firstName` + `lastName`  (NOT `fullName`)
 *
 * The backend's `createStudentSchema` is `.strict()` — sending
 * unknown keys or missing required keys returns a 400 with
 * `details[]` naming every problem. This file must produce values
 * that match the schema, or every submission fails.
 *
 * Client validation is a UX convenience — it shows inline errors
 * BEFORE the user submits. It is NEVER a security control. The
 * backend's Zod schema + Mongoose validators + unique indexes are
 * the authoritative rules. Assume a hostile client will bypass
 * this file entirely; the backend must still reject bad data.
 */

// Email regex — practical (not RFC 5322 compliant) but catches the
// common mistakes: missing @, missing dot, spaces. The backend's
// `emailSchema` uses Zod's `.email()` which is stricter, so this
// intentionally allows slightly more to avoid false rejections.
// Errors caught here are UX-friendly; the backend catches the rest.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone regex — deliberately permissive to accept international
// formats. Allows: digits, +, (), ., -, and spaces (min 7, max 25).
//
// ⚠️ KNOWN LIMITATION: this pattern accepts all-punctuation strings
// like `+() -..` as "valid" — 7 chars, all from the character class,
// no digits. A stricter pattern would require at least 7 digits:
//   /^[\d\s()+\-.]{7,25}$/.test(phone) && (phone.match(/\d/g) || []).length >= 7
// Left as-is to match the backend's `maxlength: 25` without a
// format constraint — but worth tightening if you get bad data.
const PHONE_PATTERN = /^[+()\d.\-\s]{7,25}$/;

/**
 * Default values for the "create student" form.
 *
 * Exported so the form component can do:
 *   const [values, setValues] = useState(EMPTY_STUDENT);
 * without duplicating the shape. Also useful for "reset" buttons.
 *
 * `status: "active"` matches the backend's default — new students
 * start active.
 */
export const EMPTY_STUDENT = {
  studentId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  program: "",
  status: "active",
};

/**
 * Validate a student form's values. Returns an empty object on
 * success, or a `{ fieldName: errorMessage }` map on failure.
 *
 * The return shape is designed for direct use in a form:
 *   const errors = validateStudent(values);
 *   <Input error={errors.email} ... />
 *
 * Order of operations:
 *   1. Trim all string values first (so `"   "` counts as empty)
 *   2. Length checks after emptiness (so empty doesn't trigger two errors)
 *   3. Optional fields only checked if truthy
 *
 * @param {object} values - The form's current state
 * @returns {object} - Map of `{ field: message }` for invalid fields
 */
export function validateStudent(values) {
  const errors = {};

  // Trim once, use everywhere — prevents repeating `.trim()` in
  // every check. Matches what `normalizeStudent` will send to the
  // backend, so validation reflects the actual payload.
  const studentId = values.studentId?.trim() ?? "";
  const firstName = values.firstName?.trim() ?? "";
  const lastName = values.lastName?.trim() ?? "";
  const email = values.email?.trim() ?? "";
  const phone = values.phone?.trim() ?? "";
  const program = values.program?.trim() ?? "";

  // ── studentId ──────────────────────────────────────────────
  // Optional `?.trim() ?? ""` above handles undefined values
  // (e.g., if the form is being reused for an "edit" flow where
  // a field might be missing from the initial data).
  if (!studentId) {
    errors.studentId = "Student ID is required.";
  } else if (studentId.length < 3) {
    errors.studentId = "Student ID must be at least 3 characters.";
  } else if (studentId.length > 30) {
    errors.studentId = "Student ID must not exceed 30 characters.";
  }

  // ── firstName ──────────────────────────────────────────────
  // Match the backend's `minlength: 1, maxlength: 80`. Single-char
  // names (e.g., "李") are valid — don't reject them.
  if (!firstName) {
    errors.firstName = "First name is required.";
  } else if (firstName.length > 80) {
    errors.firstName = "First name must not exceed 80 characters.";
  }

  // ── lastName ───────────────────────────────────────────────
  // Same bounds as firstName.
  if (!lastName) {
    errors.lastName = "Last name is required.";
  } else if (lastName.length > 80) {
    errors.lastName = "Last name must not exceed 80 characters.";
  }

  // ── email ──────────────────────────────────────────────────
  // 254 = RFC 5321 maximum. Backend enforces this via Zod
  // `.max(254)`.
  if (!email) {
    errors.email = "Email address is required.";
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  // ── phone (optional) ──────────────────────────────────────
  // Only validate if the user provided something. Empty is fine —
  // it means "no phone". The backend stores `null` for omitted
  // phone values (see Student model `default: null`).
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone =
      "Enter a valid phone number using digits and common phone symbols.";
  }

  // ── program (optional on backend, but required here by UX) ─
  // ⚠️ Note: the backend allows `program: null` (optional), but
  // the form requires it. That's a UX choice — if you want to allow
  // empty program, remove the `!program` check below.
  if (!program) {
    errors.program = "Program is required.";
  } else if (program.length > 100) {
    // Backend max is 100 (not 120 — see Student model).
    errors.program = "Program must not exceed 100 characters.";
  }

  // ── status ─────────────────────────────────────────────────
  // Backend enum: "active" | "inactive" | "graduated" | "suspended"
  // ⚠️ FIXED: was missing "graduated" and "suspended". A student
  // who graduated or was suspended couldn't be edited without
  // triggering a false "invalid status" error.
  if (
    !["active", "inactive", "graduated", "suspended"].includes(values.status)
  ) {
    errors.status = "Select a valid student status.";
  }

  return errors;
}

/**
 * Normalize a student form's values before sending to the backend.
 *
 * Guarantees:
 *   - All string fields are trimmed
 *   - Email is lowercased (matches backend's `lowercase: true`)
 *   - Empty optional fields become `null` (matches backend's
 *     `default: null` — avoids storing `""` where queries expect
 *     `null`)
 *
 * `?? ""` on each field handles the case where a form field is
 * `undefined` (e.g., if the payload was partially populated).
 *
 * @param {object} values - The form's current state
 * @returns {object} - Normalized values ready for `createStudent()` /
 *   `updateStudent()` API calls.
 */
export function normalizeStudent(values) {
  // Helper: empty string → null (for optional fields).
  // Why null, not ""? The Student model uses `default: null`, so
  // any query like `Student.find({ phone: null })` expects null.
  // Storing "" would silently break such queries.
  const nullIfEmpty = (v) => {
    const trimmed = v?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
  };

  return {
    studentId: values.studentId?.trim() ?? "",
    firstName: values.firstName?.trim() ?? "",
    lastName: values.lastName?.trim() ?? "",
    email: (values.email?.trim() ?? "").toLowerCase(),
    phone: nullIfEmpty(values.phone),
    program: nullIfEmpty(values.program),
    status: values.status,
  };
}
