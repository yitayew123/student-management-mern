import api from "../../../api/axiosClient";

/**
 * Unwrap the backend's response envelope.
 *
 * Same helper as `studentsApi.js` / `coursesApi.js`. Kept local
 * (rather than shared) to avoid coupling — three API modules each
 * having their own 3-line helper is cheaper than a shared utility
 * that has to anticipate every module's response-shape quirks.
 */
function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

/**
 * Fetch a paginated list of enrollments.
 *
 * ⚠️ PARAMS CONTRACT — backend's `listEnrollmentsQuerySchema` is
 * `.strict()` and whitelists exactly these keys:
 *
 *   - student        (ObjectId)  — filter by student's _id
 *   - course         (ObjectId)  — filter by course's _id
 *   - status         (enum)      — "enrolled" | "completed" | "cancelled"
 *                                  | "dropped" | "withdrawn"
 *   - academicYear   (string)    — exact match, e.g. "2026/2027"
 *   - semester       (string)    — exact match, e.g. "Semester 1"
 *   - page           (number)    — 1-based
 *   - limit          (number)    — 1–100
 *   - sortBy         (enum)      — ONE OF: enrolledAt, createdAt,
 *                                  updatedAt, status  (nothing else!)
 *   - order          (string)    — "asc" | "desc"
 *
 * ⚠️ `order` — NOT `sortOrder`. This is the same trap that broke
 * StudentsPage and CoursesPage: any unknown param (like `sortOrder`)
 * causes a `400 VALIDATION_ERROR` on EVERY request. The backend
 * query schema is strict, so unknown keys are rejected, not ignored.
 *
 * ⚠️ `sortBy` is limited to 4 fields — do NOT pass `studentName`,
 * `courseCode`, or `enrolledAt`-adjacent names. `enrolledAt` IS valid;
 * `enrollmentDate` is NOT (the field was renamed). If you're building
 * UI sort headers, use the 4 allowed values only.
 *
 * @param {object} params — optional query params (see above)
 * @returns {Promise<{ items: Array, pagination: object|null }>}
 *   - `items`       — always an array of enrollment docs. Each item
 *                     has populated `student` (studentId, firstName,
 *                     lastName, email) and `course` (courseCode, title,
 *                     credits, department) — see service's projection.
 *   - `pagination`  — `{ page, limit, total, totalPages, hasNextPage,
 *                      hasPreviousPage }`, or `null` if the endpoint
 *                      returned a bare array
 */
export async function getEnrollments(params = {}) {
  const response = await api.get("/enrollments", { params });
  const result = unwrap(response);

  // 🔴 SUGGESTED FIX (consistency with studentsApi): add a bare-array
  // fallback in case the endpoint ever returns `{ data: [...] }`
  // without the `enrollments` wrapper. Currently defensive only.
  //
  //   if (Array.isArray(result)) {
  //     return { items: result, pagination: null };
  //   }
  //
  // Without this, a bare-array response silently produces
  // `items: []` — the same class of bug that makes a refactor
  // mysteriously "break the list".
  return {
    items: result?.enrollments ?? result?.items ?? [],
    pagination: result?.pagination ?? null,
  };
}

/**
 * Create a new enrollment.
 *
 * ⚠️ PAYLOAD CONTRACT — backend's `createEnrollmentSchema` is
 * `.strict()` and requires exactly these 4 fields:
 *
 *   {
 *     "student":      "<24-char ObjectId>",   // required
 *     "course":       "<24-char ObjectId>",   // required
 *     "academicYear": "2026/2027",            // required, min 4 chars
 *     "semester":     "Semester 1"            // required, min 1 char
 *   }
 *
 * The backend's `createEnrollment` service enforces these rules:
 *   - Course must exist, be `status: "active"`, and have capacity
 *     (fails with 409 COURSE_NOT_FOUND / COURSE_NOT_ACTIVE /
 *      COURSE_CAPACITY_REACHED otherwise)
 *   - Student must exist and be `status: "active"`
 *     (fails with 409 STUDENT_NOT_FOUND / STUDENT_NOT_ACTIVE)
 *   - No duplicate active enrollment for the same student/course/term
 *     (fails with 409 DUPLICATE_ACTIVE_ENROLLMENT)
 *
 * On success: returns the enrollment doc, atomically increments the
 * Course's `enrolledCount`, and commits the whole thing in a
 * transaction (requires MongoDB replica set — see
 * `enrollmentService.withTransaction`).
 *
 * ⚠️ `academicYear` and `semester` are NOT optional — omitting them
 * causes the backend to reject with `400 VALIDATION_ERROR` (Required).
 * This is a common mistake for someone coming from Students/Courses
 * (where `department` etc. are optional). The enrollment form MUST
 * collect these two fields.
 *
 * @param {object} payload — see contract above
 * @returns {Promise<object>} — the created enrollment document
 */
export async function createEnrollment(payload) {
  const response = await api.post("/enrollments", payload);
  const result = unwrap(response);
  return result?.enrollment ?? result;
}

/**
 * Cancel an existing enrollment.
 *
 * ⚠️ SEMANTICS — this is one-way:
 *   - Cannot "un-cancel" — the user must create a new enrollment to
 *     re-enroll (allowed by the partial unique index: the cancelled
 *     record doesn't block a new `status: "enrolled"` record for the
 *     same student/course/term)
 *   - Sets `status: "cancelled"` on the record (does NOT delete it)
 *   - Stamps `cancelledAt`, `cancelledBy`, `cancellationReason` for audit
 *   - Atomically decrements `Course.enrolledCount` (seat released in
 *     the same transaction — if either step fails, both roll back)
 *
 * ⚠️ WHY `reason ? { reason } : {}` (not `{ reason }` always):
 *   The backend's `cancelEnrollmentSchema` is `.strict()` with
 *   `reason: optional().default("")`. Both `{}` (cancel with no
 *   reason) and `{ reason: "..." }` are valid. Sending
 *   `{ reason: undefined }` would fail `.strict()` because Zod's
 *   strict mode rejects keys whose value is undefined in some
 *   configurations — safer to omit the key entirely when there's
 *   no reason.
 *
 * ⚠️ `reason` max length is 500 chars (backend constraint). Longer
 * reasons are rejected with `400 VALIDATION_ERROR`. The form should
 * cap input at 500 chars to prevent this round-trip.
 *
 * ⚠️ Idempotency: re-cancelling returns `409 ENROLLMENT_ALREADY_CANCELLED`.
 * Only `status: "enrolled"` enrollments can be cancelled — a
 * `completed` / `dropped` / `withdrawn` enrollment returns
 * `409 ENROLLMENT_NOT_ACTIVE`.
 *
 * @param {string} id     — MongoDB _id of the enrollment
 * @param {string} [reason] — optional free-text reason (max 500 chars)
 * @returns {Promise<object>} — the updated (cancelled) enrollment doc
 */
export async function cancelEnrollment(id, reason) {
  const response = await api.patch(
    `/enrollments/${encodeURIComponent(id)}/cancel`,
    reason ? { reason } : {},
  );
  const result = unwrap(response);
  return result?.enrollment ?? result;
}

/**
 * Fetch a single enrollment by MongoDB `_id`.
 *
 * Returns the enrollment with FULL populated references:
 *   - `student` — full Student doc (all fields, not projected)
 *   - `course`  — full Course doc (all fields, not projected)
 *
 * This is different from `getEnrollments` (list) which PROJECTS the
 * populated docs to essential fields only. Detail views get the
 * full documents; list views get leaner ones. Design choice — the
 * list is often rendered for 10+ rows, so bloat matters there.
 *
 * 404 → `err.code === "ENROLLMENT_NOT_FOUND"`
 * 400 (bad ObjectId) → `err.code === "INVALID_ID"`
 *
 * @param {string} id — MongoDB _id
 * @returns {Promise<object>} — the enrollment document (populated)
 */
export async function getEnrollmentById(id) {
  const response = await api.get(`/enrollments/${encodeURIComponent(id)}`);
  const result = unwrap(response);
  return result?.enrollment ?? result;
}

/**
 * NOTE — functions intentionally NOT present:
 *
 *   - `updateEnrollment` — the backend has no general update endpoint
 *     for enrollments. Fields like `student`, `course`, `academicYear`,
 *     `semester` are immutable after creation (changing them would
 *     break the compound unique index and the audit trail). The only
 *     mutations are `cancel` (this file) and any status transitions
 *     the backend later exposes.
 *
 *   - `changeEnrollmentStatus` — the backend has no generic status
 *     endpoint (only `/cancel`). If you later need `completed`,
 *     `dropped`, or `withdrawn` transitions, that requires:
 *       1. A new backend route (`PATCH /:id/status` or per-status
 *          endpoints)
 *       2. A new backend service function
 *       3. A new validator (with the appropriate enum)
 *       4. A new function here (matching the pattern)
 *     Don't add it preemptively — the backend's design may change.
 *
 *   - `deleteEnrollment` — enrollments are never hard-deleted. The
 *     audit trail requires preserving cancelled records. "Removing"
 *     an enrollment means calling `cancelEnrollment()`.
 */
