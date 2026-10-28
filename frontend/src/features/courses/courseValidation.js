/**
 * Client-side validation and normalization for the Course form.
 *
 * ⚠️ IMPORTANT — field constraints must match the backend exactly.
 * Backend source of truth:
 *   - `backend/src/models/Course.js` (Mongoose schema)
 *   - `backend/src/validators/courseSchemas.js` (Zod — `.strict()`)
 *
 * If they drift (e.g., frontend allows 120-char department but
 * backend rejects > 100), the form silently passes validation and
 * the user sees a generic "Validation failed" error after a round-
 * trip. That's what prompted the fixes below.
 *
 * ⚠️ INSTRUCTOR FIELD — architectural caveat:
 * The backend's `instructor` field is a MongoDB ObjectId reference
 * to a `User` document (role "instructor") OR null — NOT a free-
 * form name string. The current form renders it as a text input,
 * which will fail on submit (backend's Zod union rejects arbitrary
 * strings). This file validates the ObjectId format to make the
 * form technically correct, but the FORM ITSELF should eventually
 * become a `<select>` populated from an instructor list endpoint.
 * See the follow-up note below.
 */

// Pattern for validating MongoDB ObjectId strings (24 hex chars).
// Matches the backend's `instructorSchema` regex exactly.
const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

export const EMPTY_COURSE = {
  courseCode: "",
  title: "",
  description: "",
  department: "",
  // 🔴 CHANGED: was `"3"` (string). Keeping it as a string is
  // actually correct for a controlled `<input type="number">`
  // (the DOM value is always a string). The `Number(...)` cast
  // in `normalizeCourse` handles conversion. Leave as "3".
  credits: "3",
  // 🔴 CHANGED: was `""` (empty string). The backend expects
  // `null` for "no instructor assigned". Keeping `""` would send
  // an invalid value that fails the Zod union. Changed to `null`
  // so initial form state matches backend expectations. When the
  // form later becomes a `<select>`, an empty option will map to
  // this null.
  instructor: null,
  semester: "",
  academicYear: "",
  capacity: "30",
  status: "active",
};

/**
 * Convert empty string to null (for optional fields).
 * Same helper pattern as `studentValidation.normalizeStudent` —
 * keeps "unset" values consistently `null` in the payload.
 */
function nullIfEmpty(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Validate a Course form's values.
 *
 * @param {object} values — form state
 * @returns {object} — `{ field: message }` map; empty on success
 *
 * Field-by-field rules (matching `courseSchemas.createCourseSchema`):
 *   - courseCode:    required, min 2, max 30
 *   - title:         required, min 2, max 150
 *   - description:   optional, max 2000
 *   - department:    required, min 2, max 100
 *   - credits:       required, integer 1–30
 *   - instructor:    optional, 24-hex ObjectId OR null
 *   - semester:      required, min 1, max 50
 *   - academicYear:  required, min 4, max 20
 *   - capacity:      required, integer 1–10000
 *   - status:        required, one of ["active","inactive","archived"]
 */
export function validateCourse(values) {
  const errors = {};

  const courseCode = values.courseCode.trim();
  const title = values.title.trim();
  const description = values.description.trim();
  const department = values.department.trim();
  const instructor = String(values.instructor ?? "").trim();
  const semester = values.semester.trim();
  const academicYear = values.academicYear.trim();

  // ── courseCode ─────────────────────────────────────────────
  // 🔴 FIXED: was missing `minlength: 2` check (backend rejects
  // 1-char codes). Now matches: required, min 2, max 30.
  if (!courseCode) {
    errors.courseCode = "Course code is required.";
  } else if (courseCode.length < 2) {
    errors.courseCode = "Course code must be at least 2 characters.";
  } else if (courseCode.length > 30) {
    errors.courseCode = "Course code must not exceed 30 characters.";
  }

  // ── title ──────────────────────────────────────────────────
  // 🔴 FIXED: was missing `minlength: 2` check.
  if (!title) {
    errors.title = "Course title is required.";
  } else if (title.length < 2) {
    errors.title = "Course title must be at least 2 characters.";
  } else if (title.length > 150) {
    errors.title = "Course title must not exceed 150 characters.";
  }

  // ── description (optional) ────────────────────────────────
  // Backend allows up to 2000 chars; defaults to "" if omitted.
  // No "required" check — an empty description is valid.
  if (description.length > 2000) {
    errors.description = "Description must not exceed 2,000 characters.";
  }

  // ── department ─────────────────────────────────────────────
  // 🔴 FIXED: was max 120 — backend's max is 100 (Course model
  // uses `maxlength: 100`, Zod uses `.max(100)`). Also added the
  // missing min 2 check for consistency with the backend.
  if (!department) {
    errors.department = "Department is required.";
  } else if (department.length < 2) {
    errors.department = "Department must be at least 2 characters.";
  } else if (department.length > 100) {
    errors.department = "Department must not exceed 100 characters.";
  }

  // ── credits ────────────────────────────────────────────────
  // 🔴 FIXED: was missing max 30 check. Values like 999 passed
  // the frontend then failed the backend. Now matches 1–30.
  const creditsNum = Number(values.credits);
  if (
    values.credits === "" ||
    !Number.isInteger(creditsNum) ||
    creditsNum < 1
  ) {
    errors.credits = "Credits must be a positive integer.";
  } else if (creditsNum > 30) {
    errors.credits = "Credits must not exceed 30.";
  }

  // ── instructor (optional, ObjectId or null) ───────────────
  // 🔴 FIXED: was a "name must be ≤ 120 chars" check — which
  // accepted arbitrary text that the backend rejects. Now:
  //   - Empty → valid (will become null in normalize)
  //   - 24-hex string → valid (matches backend's ObjectId format)
  //   - Anything else → error
  //
  // ⚠️ This validates the FORMAT, not that the ID actually exists
  // or that the user has the "instructor" role. Backend does that
  // (via the referenced User's existence). When the form becomes
  // a `<select>`, the values will be pre-validated ObjectIds and
  // this check becomes trivially true.
  if (instructor && !OBJECT_ID_PATTERN.test(instructor)) {
    errors.instructor =
      "Instructor must be a valid user reference (24-character ID).";
  }

  // ── semester ───────────────────────────────────────────────
  // Matches backend: required, min 1, max 50.
  if (!semester) {
    errors.semester = "Semester is required.";
  } else if (semester.length > 50) {
    errors.semester = "Semester must not exceed 50 characters.";
  }

  // ── academicYear ───────────────────────────────────────────
  // 🔴 FIXED: was missing the min 4 check. Backend requires
  // academicYear to be 4–20 chars (allows "2024", "2026/2027",
  // but rejects "26" as a likely typo).
  if (!academicYear) {
    errors.academicYear = "Academic year is required.";
  } else if (academicYear.length < 4) {
    errors.academicYear = "Academic year must be at least 4 characters.";
  } else if (academicYear.length > 20) {
    errors.academicYear = "Academic year must not exceed 20 characters.";
  }

  // ── capacity ───────────────────────────────────────────────
  // 🔴 FIXED: was missing max 10000 check. Values like 99999
  // passed frontend and failed backend.
  const capacityNum = Number(values.capacity);
  if (
    values.capacity === "" ||
    !Number.isInteger(capacityNum) ||
    capacityNum < 1
  ) {
    errors.capacity = "Capacity must be a positive whole number.";
  } else if (capacityNum > 10000) {
    errors.capacity = "Capacity must not exceed 10,000.";
  }

  // ── status ─────────────────────────────────────────────────
  // ✅ Matches backend enum exactly. No change needed.
  if (!["active", "inactive", "archived"].includes(values.status)) {
    errors.status = "Select a valid course status.";
  }

  return errors;
}

/**
 * Normalize a Course form's values before sending to the backend.
 *
 * Guarantees:
 *   - `courseCode` is uppercased (matches backend's `uppercase: true`)
 *   - All string fields are trimmed
 *   - `credits` and `capacity` are numbers (backend expects numbers)
 *   - `instructor` is `null` when empty (backend expects null, not "")
 *   - `description` is `""` when empty (backend's default is "")
 *
 * @param {object} values — form state
 * @returns {object} — payload ready for `createCourse()` / `updateCourse()`
 */
export function normalizeCourse(values) {
  return {
    courseCode: values.courseCode.trim().toUpperCase(),
    title: values.title.trim(),
    // Description defaults to "" (not null) — matches backend's
    // `default: ""`. A null would technically work (optional), but
    // "" is what the backend itself uses when unset.
    description: values.description.trim(),
    department: values.department.trim(),
    credits: Number(values.credits),
    // 🔴 FIXED: was `values.instructor.trim()` — sent "" for empty
    // which the backend's Zod union rejects (not an ObjectId, not
    // null). Now uses `nullIfEmpty` so empty → null.
    instructor: nullIfEmpty(values.instructor),
    semester: values.semester.trim(),
    academicYear: values.academicYear.trim(),
    capacity: Number(values.capacity),
    status: values.status,
  };
}
