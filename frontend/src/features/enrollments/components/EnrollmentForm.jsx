import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../api/axiosClient";
import SearchableSelect from "./SearchableSelect";
import EnrollmentCapacity from "./EnrollmentCapacity";

/**
 * EnrollmentForm — create a new enrollment.
 *
 * Flow:
 *   1. On mount, fetch active students and courses (parallel).
 *   2. User picks a student (searchable), a course (searchable),
 *      and a term (academic year + semester).
 *   3. On submit, POST to /api/enrollments with all 4 required fields.
 *   4. Backend enforces:
 *      - Student exists + is active
 *      - Course exists + is active + has capacity
 *      - No duplicate active enrollment for the same student/
 *        course/term (partial unique index)
 *   5. On success, parent closes the modal and reloads the list.
 *   6. On failure, error is mapped to a specific field (or form).
 *
 * ⚠️ REQUIRED FIELDS — backend's `createEnrollmentSchema` is
 * `.strict()` and requires ALL FOUR:
 *   - student       (ObjectId)
 *   - course        (ObjectId)
 *   - academicYear  (string, min 4, max 20)  ← NEW — was missing
 *   - semester      (string, min 1, max 30)  ← NEW — was missing
 *
 * Omitting academicYear or semester causes 400 VALIDATION_ERROR
 * on every submission. The form MUST collect them.
 */

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

function getItems(result, key) {
  return result?.[key] ?? result?.items ?? [];
}

function getId(item) {
  return item?._id ?? item?.id ?? "";
}

/**
 * Compute a display name from a student object.
 *
 * Fallback chain:
 *   fullName  →  firstName + lastName  →  name  →  email  →  "Unnamed student"
 *
 * 🔴 FIXED: was using `??` between all steps. The join can
 * produce an EMPTY STRING when both firstName and lastName are
 * missing — and `?? ` doesn't fall through empty strings (only
 * null/undefined). Result: rendered empty string, no fallback.
 * Now uses `||` for the join result (empty string → falsy → falls
 * through), and `??` for the full object checks (preserves `""`
 * if a field is intentionally empty).
 *
 * Actually — simplest correct approach: use `||` throughout for
 * string fallbacks, since empty strings should always fall through
 * when we're looking for a display name.
 */
function studentName(student) {
  if (student?.fullName) return student.fullName;
  const parts = [student?.firstName, student?.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (student?.name) return student.name;
  if (student?.email) return student.email;
  return "Unnamed student";
}

function courseName(course) {
  return `${course?.courseCode ?? "No code"} — ${
    course?.title ?? "Untitled course"
  }`;
}

function isActive(item) {
  return String(item?.status ?? "").toLowerCase() === "active";
}

/**
 * Map a server error to a specific field + user-friendly message.
 *
 * Prefers `error.code` (stable identifier from the backend) over
 * regex on the message — the message is human-facing and may be
 * reworded; the code is a contract.
 *
 * Falls back to regex for errors without a code (network errors,
 * client-side exceptions) or codes this function doesn't handle.
 *
 * Field names in the returned object MUST match the SearchableSelect
 * `error` prop keys in this form — `studentId`, `courseId`,
 * `academicYear`, `semester`, or `form`.
 */
function getServerMessage(error) {
  const code = error?.code;
  const message = error?.message ?? "Enrollment could not be saved.";

  // ── Structured error codes (preferred) ────────────────────
  // These match the backend's AppError codes from
  // enrollmentService.js / courseService.js.
  if (code === "DUPLICATE_ACTIVE_ENROLLMENT") {
    return {
      field: "studentId",
      message:
        "This student is already enrolled in this course for the same academic year and semester. Check the enrollment history or choose a different term.",
    };
  }

  if (code === "COURSE_CAPACITY_REACHED") {
    return {
      field: "courseId",
      message:
        "This course has reached its enrollment capacity. Select a different course or increase the capacity first.",
    };
  }

  if (code === "COURSE_NOT_ACTIVE") {
    return {
      field: "courseId",
      message: "This course is not active. Select an active course.",
    };
  }

  if (code === "COURSE_NOT_FOUND") {
    return {
      field: "courseId",
      message: "The selected course no longer exists.",
    };
  }

  if (code === "STUDENT_NOT_ACTIVE") {
    return {
      field: "studentId",
      message:
        "This student is inactive and cannot be enrolled. Reactivate the student record first.",
    };
  }

  if (code === "STUDENT_NOT_FOUND") {
    return {
      field: "studentId",
      message: "The selected student no longer exists.",
    };
  }

  if (code === "VALIDATION_ERROR") {
    // The backend returns `details: [{ field, message }]` for
    // validation errors. Check if any of our known fields is
    // among them so we can point at the right input.
    const details = error?.details;
    if (Array.isArray(details)) {
      for (const item of details) {
        const field = item?.field ?? item?.path?.at?.(-1);
        if (field === "academicYear") {
          return {
            field: "academicYear",
            message: item.message ?? "Academic year is required.",
          };
        }
        if (field === "semester") {
          return {
            field: "semester",
            message: item.message ?? "Semester is required.",
          };
        }
        if (field === "student") {
          return {
            field: "studentId",
            message: item.message ?? "Invalid student selection.",
          };
        }
        if (field === "course") {
          return {
            field: "courseId",
            message: item.message ?? "Invalid course selection.",
          };
        }
      }
    }
    // Fall back to form-level if we can't pinpoint a specific field.
    return { field: "form", message };
  }

  // ── Network / connection errors ───────────────────────────
  if (error?.isNetworkError) {
    return {
      field: "form",
      message:
        "Cannot connect to the server. Check your connection and try again.",
    };
  }

  // ── Regex fallback for errors without a code ──────────────
  // 🔴 FIXED: was `/duplicate|already enrolled|already exists/i`
  // — didn't match the backend's actual message
  // "The student already has an active enrollment in this course."
  // Now uses `error.code` above, with regex as last resort for
  // errors that don't carry a code.
  if (/already has an active enrollment|duplicate/i.test(message)) {
    return {
      field: "studentId",
      message: "This student already has an active enrollment in this course.",
    };
  }

  if (/capacity|full/i.test(message)) {
    return {
      field: "courseId",
      message: "The course has reached its enrollment capacity.",
    };
  }

  if (/inactive student/i.test(message)) {
    return {
      field: "studentId",
      message: "This student is inactive and cannot be enrolled.",
    };
  }

  if (/inactive course|archived/i.test(message)) {
    return {
      field: "courseId",
      message: "This course is not available for enrollment.",
    };
  }

  // Unknown error → form-level.
  return { field: "form", message };
}

export default function EnrollmentForm({
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");

  // ✅ ADDED: academic year + semester — REQUIRED by the backend.
  // Two text inputs — simple and permissive (formats vary by
  // institution). Could be replaced with a preset dropdown once
  // the product decides on standard term formats.
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState("");

  const [errors, setErrors] = useState({});

  // Refs for focusing the first invalid field after submit failure.
  const yearRef = useRef(null);
  const semesterRef = useRef(null);

  // ✅ ADDED: `loadOptions` is now a stable function so the retry
  // button can call it directly (no full-page reload).
  async function loadOptions() {
    setLoadingOptions(true);
    setOptionsError("");

    try {
      const [studentResponse, courseResponse] = await Promise.all([
        api.get("/students", {
          params: { page: 1, limit: 500, status: "active" },
        }),
        api.get("/courses", {
          params: { page: 1, limit: 500, status: "active" },
        }),
      ]);

      const studentResult = unwrap(studentResponse);
      const courseResult = unwrap(courseResponse);

      setStudents(getItems(studentResult, "students"));
      setCourses(getItems(courseResult, "courses"));
    } catch (error) {
      setOptionsError(
        error?.isNetworkError
          ? "Unable to connect to the server while loading students and courses."
          : (error?.message ??
              "Unable to load the student and course options."),
      );
    } finally {
      setLoadingOptions(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadingOptions(true);
      setOptionsError("");

      try {
        const [studentResponse, courseResponse] = await Promise.all([
          api.get("/students", {
            params: { page: 1, limit: 500, status: "active" },
          }),
          api.get("/courses", {
            params: { page: 1, limit: 500, status: "active" },
          }),
        ]);

        const studentResult = unwrap(studentResponse);
        const courseResult = unwrap(courseResponse);

        if (active) {
          setStudents(getItems(studentResult, "students"));
          setCourses(getItems(courseResult, "courses"));
        }
      } catch (error) {
        if (active) {
          setOptionsError(
            error?.isNetworkError
              ? "Unable to connect to the server while loading students and courses."
              : (error?.message ??
                  "Unable to load the student and course options."),
          );
        }
      } finally {
        if (active) setLoadingOptions(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const selectedStudent = useMemo(
    () => students.find((s) => String(getId(s)) === String(studentId)),
    [students, studentId],
  );

  const selectedCourse = useMemo(
    () => courses.find((c) => String(getId(c)) === String(courseId)),
    [courses, courseId],
  );

  const studentOptions = useMemo(
    () =>
      students.map((student) => ({
        ...student,
        optionLabel: `${studentName(student)}${
          // 🔴 FIXED: was `student?.studentNumber` — backend field
          // is `studentId`. Reading the wrong field meant the
          // business ID NEVER displayed in the option label.
          student?.studentId ? ` (${student.studentId})` : ""
        }`,
      })),
    [students],
  );

  const courseOptions = useMemo(
    () =>
      courses.map((course) => ({
        ...course,
        optionLabel: courseName(course),
      })),
    [courses],
  );

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};

    if (!studentId) nextErrors.studentId = "Select a student.";
    if (!courseId) nextErrors.courseId = "Select a course.";

    // ✅ ADDED: term validation — backend requires both.
    if (!academicYear.trim()) {
      nextErrors.academicYear = "Academic year is required.";
    } else if (academicYear.trim().length < 4) {
      nextErrors.academicYear =
        "Academic year must be at least 4 characters (e.g. 2026 or 2026/2027).";
    }

    if (!semester.trim()) {
      nextErrors.semester = "Semester is required.";
    }

    if (selectedStudent && !isActive(selectedStudent)) {
      nextErrors.studentId = "The selected student is inactive.";
    }

    if (selectedCourse && !isActive(selectedCourse)) {
      nextErrors.courseId = "The selected course is not active.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      // ✅ ADDED: focus the first invalid field so SR users hear
      // the error immediately. Order matches visual order (top to
      // bottom of the form).
      if (nextErrors.studentId) {
        document.getElementById("enrollment-student")?.focus();
      } else if (nextErrors.courseId) {
        document.getElementById("enrollment-course")?.focus();
      } else if (nextErrors.academicYear) {
        yearRef.current?.focus();
      } else if (nextErrors.semester) {
        semesterRef.current?.focus();
      }
      return;
    }

    try {
      // 🔴 FIXED: was `{ student: studentId, course: courseId }` —
      // missing `academicYear` and `semester`. The backend requires
      // all 4 fields, so every submission was returning
      // 400 VALIDATION_ERROR before reaching the database.
      await onSubmit({
        student: studentId,
        course: courseId,
        academicYear: academicYear.trim(),
        semester: semester.trim(),
      });
    } catch (error) {
      const mapped = getServerMessage(error);
      setErrors((current) => ({
        ...current,
        [mapped.field]: mapped.message,
      }));
    }
  }

  // Whether the form is ready for submission. Passing all checks
  // enables the submit button; failing any keeps it disabled (but
  // shows the reason via the alerts / required fields).
  const submitDisabled =
    submitting ||
    loadingOptions ||
    Boolean(optionsError) ||
    !students.length ||
    !courses.length;

  return (
    <form
      className="enrollment-form"
      onSubmit={handleSubmit}
      noValidate
      // ✅ ADDED: `aria-busy` — announces to SRs that the form is
      // processing during submit.
      aria-busy={submitting}
    >
      {optionsError && (
        <div className="enrollment-alert enrollment-alert-error" role="alert">
          <p>{optionsError}</p>
          {/* 🔴 FIXED: was `window.location.reload()` — full-page
              reload for a network blip is jarring and loses any
              context the user had. `loadOptions` retries the fetch
              without reloading. */}
          <button
            type="button"
            className="enrollment-button enrollment-button-secondary"
            onClick={loadOptions}
            disabled={loadingOptions}
          >
            {loadingOptions ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      {errors.form && (
        <div className="enrollment-alert enrollment-alert-error" role="alert">
          {errors.form}
        </div>
      )}

      {loadingOptions ? (
        <div className="enrollment-loading" role="status">
          Loading students and courses...
        </div>
      ) : (
        <>
          <SearchableSelect
            id="enrollment-student"
            label="Student"
            options={studentOptions}
            value={studentId}
            onChange={(value) => {
              setStudentId(value);
              setErrors((current) => ({
                ...current,
                studentId: "",
                form: "",
              }));
            }}
            placeholder="Search by name, student ID, or email..."
            disabled={submitting}
            required
            error={errors.studentId}
            getLabel={(student) => student.optionLabel}
            getValue={getId}
            getSearchText={(student) =>
              [
                student.optionLabel,
                student.email,
                // 🔴 FIXED: was `student.studentNumber` — backend
                // field is `studentId`. Search by ID returned no
                // matches.
                student.studentId,
              ]
                .filter(Boolean)
                .join(" ")
            }
            renderOption={(student) => (
              <span className="enrollment-option-content">
                <strong>{student.optionLabel}</strong>
                <small>
                  {student.email ?? "No email"} · Status:{" "}
                  {student.status ?? "Unknown"}
                </small>
              </span>
            )}
          />

          {selectedStudent && (
            <div className="enrollment-selection-summary">
              <strong>Selected student</strong>
              <p>{studentName(selectedStudent)}</p>
              <small>
                {selectedStudent.email ?? "No email"} · Status:{" "}
                {selectedStudent.status ?? "Unknown"}
              </small>
            </div>
          )}

          <SearchableSelect
            id="enrollment-course"
            label="Course"
            options={courseOptions}
            value={courseId}
            onChange={(value) => {
              setCourseId(value);
              setErrors((current) => ({
                ...current,
                courseId: "",
                form: "",
              }));
            }}
            placeholder="Search by course code, title, or department..."
            disabled={submitting}
            required
            error={errors.courseId}
            getLabel={(course) => course.optionLabel}
            getValue={getId}
            getSearchText={(course) =>
              [course.optionLabel, course.department, course.instructor]
                .filter(Boolean)
                .join(" ")
            }
            renderOption={(course) => (
              <span className="enrollment-option-content">
                <strong>{course.optionLabel}</strong>
                <small>
                  Status: {course.status ?? "Unknown"} · Department:{" "}
                  {course.department ?? "Not specified"}
                </small>
              </span>
            )}
          />

          {selectedCourse && (
            <div className="enrollment-selection-summary">
              <strong>Selected course</strong>
              <p>{courseName(selectedCourse)}</p>
              <small>Status: {selectedCourse.status ?? "Unknown"}</small>
              <EnrollmentCapacity course={selectedCourse} />
            </div>
          )}

          {/* ✅ ADDED: academic year + semester — the two REQUIRED
              fields the backend was rejecting on every submit.
              Plain text inputs with permissive validation (min 4
              for year, min 1 for semester). Callers can extend
              later with preset lists if the institution standardizes
              term formats. */}
          <div className="enrollment-field">
            <label htmlFor="enrollment-academic-year">
              Academic year
              <span className="enrollment-required" aria-hidden="true">
                {" *"}
              </span>
            </label>
            <input
              ref={yearRef}
              id="enrollment-academic-year"
              type="text"
              value={academicYear}
              onChange={(event) => {
                setAcademicYear(event.target.value);
                setErrors((current) => ({
                  ...current,
                  academicYear: "",
                  form: "",
                }));
              }}
              placeholder="e.g. 2026/2027"
              disabled={submitting}
              required
              aria-invalid={Boolean(errors.academicYear)}
              aria-describedby={
                errors.academicYear
                  ? "enrollment-academic-year-error"
                  : undefined
              }
            />
            {errors.academicYear && (
              <p
                className="enrollment-field-error"
                id="enrollment-academic-year-error"
              >
                {errors.academicYear}
              </p>
            )}
          </div>

          <div className="enrollment-field">
            <label htmlFor="enrollment-semester">
              Semester
              <span className="enrollment-required" aria-hidden="true">
                {" *"}
              </span>
            </label>
            <input
              ref={semesterRef}
              id="enrollment-semester"
              type="text"
              value={semester}
              onChange={(event) => {
                setSemester(event.target.value);
                setErrors((current) => ({
                  ...current,
                  semester: "",
                  form: "",
                }));
              }}
              placeholder="e.g. Semester 1 or Fall"
              disabled={submitting}
              required
              aria-invalid={Boolean(errors.semester)}
              aria-describedby={
                errors.semester ? "enrollment-semester-error" : undefined
              }
            />
            {errors.semester && (
              <p
                className="enrollment-field-error"
                id="enrollment-semester-error"
              >
                {errors.semester}
              </p>
            )}
          </div>

          {/* 🔴 CHANGED: `role="alert"` → `role="status"` for the
              two warning messages. `alert` is assertive (interrupts
              the SR mid-sentence), appropriate for errors. A
              warning about the current selection is informational,
              not urgent — `status` (polite) is the right level. */}
          {selectedStudent && !isActive(selectedStudent) && (
            <div
              className="enrollment-alert enrollment-alert-warning"
              role="status"
            >
              This student is inactive. The enrollment cannot proceed unless the
              student record is made eligible.
            </div>
          )}

          {selectedCourse && !isActive(selectedCourse) && (
            <div
              className="enrollment-alert enrollment-alert-warning"
              role="status"
            >
              This course is inactive or unavailable. Select an active course to
              continue.
            </div>
          )}

          <div className="enrollment-form-actions">
            <button
              type="button"
              className="enrollment-button enrollment-button-secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="enrollment-button enrollment-button-primary"
              disabled={submitDisabled}
            >
              {submitting ? "Enrolling..." : "Create enrollment"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
