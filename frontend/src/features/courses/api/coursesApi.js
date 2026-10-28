import api from "../../../api/axiosClient";

/**
 * Unwrap the backend's response envelope.
 *
 * Backend returns: `{ success: true, data: <payload> }`
 * Returns `<payload>` in that case, or the body itself if an
 * endpoint ever returns data at the top level (defensive).
 *
 * ⚠️ Same helper exists in `studentsApi.js` — kept as a local copy
 * rather than shared util for now (small duplication, avoids
 * cross-module coupling if one feature's response shape diverges).
 */
function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

/**
 * Fetch a paginated (or unpaginated) list of courses.
 *
 * ⚠️ IMPORTANT — query params contract (backend `.strict()` schema):
 *   `listCoursesQuerySchema` rejects unknown params with 400.
 *   Only these keys are allowed:
 *     - search         (string)  — substring across courseCode, title, description, department
 *     - department     (string)  — EXACT match (case-insensitive), not substring
 *     - status         (string)  — "active" | "inactive" | "archived"
 *     - semester       (string)  — exact match, case-sensitive
 *     - academicYear   (string)  — exact match, case-sensitive
 *     - page           (number)  — 1-based
 *     - limit          (number)  — 1–100
 *     - sortBy         (string)  — one of: courseCode, title, department,
 *                                  credits, capacity, semester, academicYear,
 *                                  status, createdAt
 *     - order          (string)  — "asc" | "desc"  (NOT `sortOrder`)
 *
 * ⚠️ `sortOrder` is the MOST common mistake — see the same bug
 * fixed in StudentsPage.jsx (which sends `sortOrder` by habit).
 * The backend expects `order`. Passing `sortOrder` → 400.
 *
 * ⚠️ `capacity` is a valid `sortBy` value, but the Course model has
 * NO index on `capacity`. Sorting by it triggers a full collection
 * scan. Fine at small scale; remove from `sortBy` or add an index
 * if the list becomes hot.
 *
 * @param {object} params — Optional query params (see above)
 * @returns {Promise<{ items: Array, pagination: object|null }>}
 *   - `items`       — always an array
 *   - `pagination`  — `{ page, limit, total, totalPages, hasNextPage,
 *                      hasPreviousPage }`, or `null`
 */
export async function getCourses(params = {}) {
  const response = await api.get("/courses", { params });
  const result = unwrap(response);

  // 🔴 SUGGESTED FIX (consistency with studentsApi): add a
  // bare-array fallback in case a future endpoint (or a test mock)
  // returns `{ data: [...] }` without a `courses` wrapper.
  //
  //   if (Array.isArray(result)) {
  //     return { items: result, pagination: null };
  //   }
  //
  // Without this, a bare-array response silently produces
  // `items: []` — a "works until it doesn't" failure mode.
  //
  // Currently the backend always returns `{ courses, pagination }`,
  // so this is defensive-only. Apply the fix when convenient.
  return {
    items: result?.courses ?? result?.items ?? [],
    pagination: result?.pagination ?? null,
  };
}

/**
 * Fetch a single course by MongoDB `_id`.
 *
 * `encodeURIComponent(id)` prevents path injection — same pattern
 * as `studentsApi.getStudentById`.
 *
 * 404 → `err.code === "COURSE_NOT_FOUND"` (from backend errorHandler)
 * 400 (bad ObjectId) → `err.code === "INVALID_ID"`
 *
 * @throws {Error} `{ message, status, code, details }` — normalized
 *   by the axios interceptor. Callers must try/catch.
 */
export async function getCourseById(id) {
  const response = await api.get(`/courses/${encodeURIComponent(id)}`);
  const result = unwrap(response);
  return result?.course ?? result;
}

/**
 * Create a new course.
 *
 * @param {object} course — Payload validated by `createCourseSchema`:
 *   - courseCode    (string, 2–30 chars, auto-uppercased)
 *   - title         (string, 2–150)
 *   - department    (string, 2–100)
 *   - credits       (number, 1–30)
 *   - semester      (string, 1–50)
 *   - academicYear  (string, 4–20)
 *   - capacity      (number, 1–10000) — optional, defaults to 30
 *   - description   (string, max 2000) — optional, defaults to ""
 *   - instructor    (ObjectId | null) — optional, defaults to null
 *   - status        (enum) — optional, defaults to "active"
 *
 * 409 → `err.code === "DUPLICATE_COURSE_CODE"`
 * 400 → `err.code === "VALIDATION_ERROR"` (with `details[]`)
 */
export async function createCourse(course) {
  const response = await api.post("/courses", course);
  const result = unwrap(response);
  return result?.course ?? result;
}

/**
 * Update an existing course (partial update — PATCH).
 *
 * Only fields present in `course` are updated (`$set` semantics on
 * the backend). Omitted fields keep their current values.
 *
 * ⚠️ `capacity` has a special guard: cannot be reduced below the
 * current `enrolledCount`. Attempting to do so returns
 * `409 CAPACITY_BELOW_ENROLLMENTS` (see courseService.updateCourse).
 *
 * 404 → `err.code === "COURSE_NOT_FOUND"`
 * 409 → `err.code === "DUPLICATE_COURSE_CODE"` (if changing courseCode)
 * 409 → `err.code === "CAPACITY_BELOW_ENROLLMENTS"`
 */
export async function updateCourse(id, course) {
  const response = await api.patch(
    `/courses/${encodeURIComponent(id)}`,
    course,
  );
  const result = unwrap(response);
  return result?.course ?? result;
}

/**
 * Update a course's lifecycle status.
 *
 * Separate from `updateCourse` because status transitions have
 * their own endpoint with distinct semantics — and may later gain
 * their own guards (e.g., "cannot archive a course with active
 * enrollments").
 *
 * @param {string} id     — MongoDB `_id`
 * @param {string} status — "active" | "inactive" | "archived"
 *
 * 404 → `err.code === "COURSE_NOT_FOUND"`
 * 400 → `err.code === "VALIDATION_ERROR"` (invalid enum value)
 */
export async function updateCourseStatus(id, status) {
  const response = await api.patch(
    `/courses/${encodeURIComponent(id)}/status`,
    { status },
  );
  const result = unwrap(response);
  return result?.course ?? result;
}
