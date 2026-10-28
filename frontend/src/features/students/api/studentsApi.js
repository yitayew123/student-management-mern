import api from "../../../api/axiosClient";

/**
 * Unwrap the backend's response envelope.
 *
 * Backend returns: `{ success: true, data: <payload> }`
 * This returns `<payload>` in that case, or the body itself if an
 * endpoint ever returns data at the top level (defensive — matches
 * the same pattern as `AuthContext.getPayload`).
 *
 * The `??` operator is critical here (not `||`):
 *   - If `body.data` is `0` or `false`, `||` would fall through
 *   - `??` only falls through on `null` / `undefined`
 * Currently payloads are always objects or arrays, so this matters
 * more for future endpoints than it does today.
 */
function unwrap(response) {
  const body = response?.data;
  return body?.data ?? body;
}

/**
 * Fetch a paginated (or unpaginated) list of students.
 *
 * @param {object} params - Query params passed to the backend:
 *   - search        (string)  - substring across name/email/studentId
 *   - status        (string)  - "active" | "inactive" | "graduated" | "suspended"
 *   - page          (number)  - 1-based
 *   - limit         (number)  - 1–100
 *   - sortBy        (string)  - whitelisted field
 *   - order         (string)  - "asc" | "desc"
 *
 * @returns {Promise<{ items: Array, pagination: object|null }>}
 *   - items       - always an array (empty if no results)
 *   - pagination  - `{ page, limit, total, totalPages, hasNextPage,
 *                     hasPreviousPage }` from the backend, or `null`
 *                     if the endpoint returned a bare array (legacy /
 *                     test mode)
 *
 * ⚠️ DO NOT simplify the response-shape detection without checking
 * the backend. `studentService.listStudents` returns `{ students,
 * pagination }`, but this function ALSO handles bare arrays and
 * alternate keys (`items`, `results`, `meta`, `pageInfo`) for
 * robustness. Removing any of these fallbacks is a breaking change.
 */
export async function getStudents(params = {}) {
  const response = await api.get("/students", { params });
  const result = unwrap(response);

  // Bare array response — no pagination info available.
  // Returned by some endpoints that don't paginate (e.g., a
  // `/students/all` variant, or a future export endpoint).
  if (Array.isArray(result)) {
    return {
      items: result,
      pagination: null,
    };
  }

  // Paginated response — try the known payload keys.
  // Backend uses `students`, but `items` / `results` are common
  // REST conventions other endpoints might adopt.
  const items = result?.students ?? result?.items ?? result?.results ?? [];

  return {
    items,
    // Same tolerance for pagination metadata naming:
    //   - backend uses `pagination`
    //   - `meta` / `pageInfo` are common alternatives (Stripe, GraphQL)
    pagination: result?.pagination ?? result?.meta ?? result?.pageInfo ?? null,
  };
}

/**
 * Fetch a single student by MongoDB `_id`.
 *
 * `encodeURIComponent(id)` prevents path injection if `id` ever
 * contains `/`, `?`, `#`, or `..` — current `_id` values are
 * 24-hex so this is defensive, but it costs nothing and prevents
 * a whole class of URL-construction bugs.
 *
 * 404 → `axiosClient` interceptor maps to `err.code === "STUDENT_NOT_FOUND"`
 * 400 (bad ObjectId) → `err.code === "INVALID_ID"`
 *
 * @throws {Error} `{ message, status, code, details }` — normalized
 *   by the axios interceptor. Callers must try/catch.
 */
export async function getStudentById(id) {
  const response = await api.get(`/students/${encodeURIComponent(id)}`);

  const result = unwrap(response);

  // Backend wraps as `{ student: {...} }` — but tolerate a bare
  // student object for flexibility.
  return result?.student ?? result;
}

/**
 * Create a new student.
 *
 * @param {object} student - Payload validated by `createStudentSchema`
 *   (studentId, firstName, lastName, email, optional phone/gender/…).
 *
 * Returns the created student document (with `_id`, timestamps,
 * and server-defaults applied).
 *
 * 409 → `err.code === "DUPLICATE_STUDENT"` (studentId or email)
 * 400 → `err.code === "VALIDATION_ERROR"` (Zod failure, with `details[]`)
 */
export async function createStudent(student) {
  const response = await api.post("/students", student);
  const result = unwrap(response);
  return result?.student ?? result;
}

/**
 * Update an existing student (partial update — PATCH).
 *
 * Only fields present in `student` are updated (`$set` semantics
 * on the backend). Omitted fields keep their current values.
 *
 * 404 → `err.code === "STUDENT_NOT_FOUND"`
 * 409 → `err.code === "DUPLICATE_STUDENT"` (if changing studentId
 *        or email to a value already in use)
 */
export async function updateStudent(id, student) {
  const response = await api.patch(
    `/students/${encodeURIComponent(id)}`,
    student,
  );
  const result = unwrap(response);
  return result?.student ?? result;
}

/**
 * Update a student's lifecycle status.
 *
 * Separate from `updateStudent` because status transitions have
 * their own endpoint (and their own guard: cannot deactivate a
 * student with active enrollments — 409 `STUDENT_HAS_ACTIVE_ENROLLMENTS`).
 *
 * @param {string} id     - MongoDB `_id`
 * @param {string} status - "active" | "inactive" | "graduated" | "suspended"
 */
export async function updateStudentStatus(id, status) {
  const response = await api.patch(
    `/students/${encodeURIComponent(id)}/status`,
    { status },
  );
  const result = unwrap(response);
  return result?.student ?? result;
}
