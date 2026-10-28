import { useEffect, useRef, useState } from "react";
import {
  EMPTY_COURSE,
  normalizeCourse,
  validateCourse,
} from "../courseValidation";

/**
 * Field configuration for the create/edit form.
 *
 * ⚠️ Field names MUST match the backend Course model exactly.
 * Backend source of truth:
 *   - `backend/src/models/Course.js`
 *   - `backend/src/validators/courseSchemas.js`
 *
 * Field mapping:
 *   - `courseCode`   → business ID (auto-uppercased)
 *   - `title`
 *   - `department`   → required, max 100 chars (NOT 120)
 *   - `instructor`   → ⚠️ see architectural note below
 *   - `semester`
 *   - `academicYear`
 *
 * ⚠️ ARCHITECTURAL NOTE — instructor field:
 * The backend's `instructor` is a MongoDB ObjectId referencing a
 * User document with role "instructor", OR null. It is NOT a free-
 * form name string. This form currently renders it as a text input,
 * which will fail backend validation unless the user types a valid
 * 24-hex ObjectId (impossible UX).
 *
 * The validation layer (courseValidation.js) now enforces the
 * ObjectId format, so the form is *technically* correct — but the
 * UX is unusable. Proper fix: replace the text input with a
 * <select> populated from a "list instructors" endpoint. Deferred
 * until CoursesPage is built.
 */
const FIELDS = [
  {
    name: "courseCode",
    label: "Course code",
    placeholder: "e.g. SE301",
    required: true,
    // minLength: 2 (backend constraint); maxLength: 30
    minLength: 2,
    maxLength: 30,
  },
  {
    name: "title",
    label: "Course title",
    placeholder: "e.g. Full-Stack Web Development",
    required: true,
    minLength: 2,
    maxLength: 150,
  },
  {
    name: "department",
    label: "Department",
    placeholder: "e.g. Software Engineering",
    required: true,
    minLength: 2,
    // 🔴 FIXED: was 120 — backend max is 100. Users could type
    // values the backend rejects (100-char limit in Course model +
    // Zod schema). Now aligned.
    maxLength: 100,
  },
  {
    name: "instructor",
    label: "Instructor",
    // ⚠️ See architectural note above. Placeholder accepts ObjectId
    // since that's what the backend expects — until this becomes a
    // <select>, the placeholder at least hints at the format.
    placeholder: "Instructor ID (24-char hex) or leave blank",
    maxLength: 24,
  },
  {
    name: "semester",
    label: "Semester",
    placeholder: "e.g. Semester 1",
    required: true,
    minLength: 1,
    maxLength: 50,
  },
  {
    name: "academicYear",
    label: "Academic year",
    placeholder: "e.g. 2026/2027",
    required: true,
    minLength: 4,
    maxLength: 20,
  },
];

// Field names the form renders — used to filter server errors to
// only fields that have an error slot in the UI.
const FORM_FIELDS = new Set([
  ...FIELDS.map((f) => f.name),
  "credits",
  "capacity",
  "status",
  "description",
]);

/**
 * Map a normalized backend error into field-level errors + a
 * form-level error, suitable for this form's UI.
 *
 * @param {Error} error — normalized by axiosClient interceptor
 *   ({ message, code, status, details })
 * @returns {object} — `{ fieldName?: message, form?: message }`
 *
 * Handles BOTH server error shapes:
 *   - Backend (errorHandler.js): `[{ field, message }]`
 *   - Raw Zod safeParse:         `[{ path: [...], message }]`
 *
 * Errors for fields the form doesn't render (e.g., `yearLevel`)
 * are promoted to `result.form` so they aren't silently lost.
 */
function mapServerErrors(error) {
  const result = {};
  const details = error?.details;

  // ── Field-level errors from `details` ─────────────────────
  if (Array.isArray(details)) {
    for (const item of details) {
      // 🔴 FIXED: was `item.path` only — backend uses `item.field`.
      // Zod's raw safeParse uses `item.path` (an array of segments).
      // Support both, preferring the backend's `field` key.
      const rawField =
        item?.field ?? // backend shape
        (Array.isArray(item?.path) ? item.path.at(-1) : item?.path) ??
        null;

      const fieldName = rawField ? String(rawField).split(".").at(-1) : null;

      if (!fieldName) continue;

      const message = item.message ?? "Check this value.";

      // 🔴 FIXED: only set errors for fields the form actually
      // renders. Errors for unknown fields (e.g., `yearLevel` on
      // an endpoint that uses a different schema) are promoted to
      // a form-level error below, so the user isn't left with
      // silent failures.
      if (FORM_FIELDS.has(fieldName)) {
        result[fieldName] = message;
      } else {
        // Unknown field — surface as form-level error.
        result.form = result.form ? `${result.form} ${message}` : message;
      }
    }
  } else if (details && typeof details === "object") {
    // Fallback: `details` as a plain `{ field: message }` map.
    for (const [key, value] of Object.entries(details)) {
      const fieldName = String(key).split(".").at(-1);
      const message =
        typeof value === "string"
          ? value
          : (value?.message ?? "Check this value.");

      if (FORM_FIELDS.has(fieldName)) {
        result[fieldName] = message;
      } else {
        result.form = result.form ? `${result.form} ${message}` : message;
      }
    }
  }

  // ── Error-code-specific handling ──────────────────────────
  // Prefer `error.code` (stable, from the axios interceptor's
  // normalization) over regex on the message. Fall back to regex
  // for errors that don't come from the backend (e.g., network
  // errors, custom errors from tests).
  const code = error?.code;
  const message = error?.message ?? "Unable to save this course.";

  if (code === "DUPLICATE_COURSE_CODE") {
    // Course code conflict — always points at `courseCode`.
    result.courseCode = result.courseCode ?? message;
  } else if (code === "CAPACITY_BELOW_ENROLLMENTS") {
    // Capacity reduction below active enrollments — points at
    // `capacity`.
    result.capacity = result.capacity ?? message;
  } else if (!code && /duplicate|already exists|unique/i.test(message)) {
    // Fallback regex path for errors without a code (shouldn't
    // happen with the current backend, but defensive).
    if (/course\s*code/i.test(message)) {
      result.courseCode = message;
    } else {
      result.form = result.form ?? message;
    }
  }

  // ── Last resort: if no errors mapped, show the message as form ─
  if (Object.keys(result).length === 0) {
    result.form = message;
  }

  return result;
}

/**
 * CourseForm — create/edit form for a course.
 *
 * ⚠️ IMPORTANT FOR PARENTS (initialValues):
 * The internal state resets whenever `initialValues` changes by
 * REFERENCE. If you pass an inline object literal
 * (`<CourseForm initialValues={{...}} />`), it will be a new
 * reference on every parent render — causing the form to reset
 * mid-edit and wipe the user's typing.
 *
 * Fix in the parent:
 *   - Memoize: `const init = useMemo(() => ({...}), [deps])`
 *   - OR pass `initialValues={undefined}` for create mode
 *   - OR pass a stable reference from state
 */
export default function CourseForm({
  initialValues,
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const [values, setValues] = useState({
    ...EMPTY_COURSE,
    ...initialValues,
    // Credits + capacity are numbers on the model but strings in
    // the form (input values are always strings). Coerce here so
    // the form's initial state is consistent.
    credits: String(initialValues?.credits ?? EMPTY_COURSE.credits),
    capacity: String(initialValues?.capacity ?? EMPTY_COURSE.capacity),
  });

  const [errors, setErrors] = useState({});

  // Refs for focus management — move focus to first invalid field
  // after submit failure (same pattern as StudentForm).
  const fieldRefs = useRef({});
  const creditsRef = useRef(null);
  const capacityRef = useRef(null);
  const statusRef = useRef(null);
  const descriptionRef = useRef(null);

  // ⚠️ See "IMPORTANT FOR PARENTS" note in the JSDoc above.
  useEffect(() => {
    setValues({
      ...EMPTY_COURSE,
      ...initialValues,
      credits: String(initialValues?.credits ?? EMPTY_COURSE.credits),
      capacity: String(initialValues?.capacity ?? EMPTY_COURSE.capacity),
    });
    setErrors({});
  }, [initialValues]);

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    // Clear this field's error + the form-level error on edit —
    // standard pattern; prevents stale errors after the user fixes
    // the value.
    setErrors((current) => ({
      ...current,
      [name]: "",
      form: "",
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateCourse(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      // ✅ ADDED: focus the first invalid field so SR users hear
      // the error immediately — otherwise they submit and hear
      // nothing (the errors appear visually but aren't announced
      // unless they Tab through every field).
      //
      // Iteration order matches visual order (FIELDS first, then
      // credits/capacity/status/description).
      const firstInvalid = FIELDS.find((f) => validationErrors[f.name]);
      if (firstInvalid) {
        fieldRefs.current[firstInvalid.name]?.focus();
      } else if (validationErrors.credits) {
        creditsRef.current?.focus();
      } else if (validationErrors.capacity) {
        capacityRef.current?.focus();
      } else if (validationErrors.status) {
        statusRef.current?.focus();
      } else if (validationErrors.description) {
        descriptionRef.current?.focus();
      }
      return;
    }

    try {
      await onSubmit(normalizeCourse(values));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        ...mapServerErrors(error),
      }));
    }
  }

  function renderField(field) {
    const error = errors[field.name];
    const id = `course-${field.name}`;

    return (
      <div className="course-field" key={field.name}>
        <label htmlFor={id}>
          {field.label}
          {field.required && (
            // ✅ ADDED: `aria-hidden` on the visual asterisk — the
            // `required` HTML attribute already announces
            // requiredness to screen readers.
            <span className="course-required" aria-hidden="true">
              {" *"}
            </span>
          )}
        </label>

        <input
          // ✅ ADDED: ref for focus management on validation failure.
          ref={(el) => {
            fieldRefs.current[field.name] = el;
          }}
          id={id}
          name={field.name}
          type="text"
          value={values[field.name] ?? ""}
          placeholder={field.placeholder}
          minLength={field.minLength}
          maxLength={field.maxLength}
          required={field.required}
          disabled={submitting}
          onChange={handleChange}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />

        {error && (
          <p className="course-field-error" id={`${id}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="course-form"
      onSubmit={handleSubmit}
      noValidate
      // ✅ ADDED: `aria-busy` tells screen readers the form is
      // processing during submit — complements the disabled inputs
      // (which some SRs don't announce).
      aria-busy={submitting}
    >
      {errors.form && (
        <div className="course-form-alert" role="alert">
          {errors.form}
        </div>
      )}

      <div className="course-form-grid">
        {FIELDS.map(renderField)}

        <div className="course-field">
          <label htmlFor="course-credits">
            Credits
            <span className="course-required" aria-hidden="true">
              {" *"}
            </span>
          </label>
          <input
            ref={creditsRef}
            id="course-credits"
            name="credits"
            type="number"
            min="1"
            max="30"
            step="1"
            value={values.credits}
            onChange={handleChange}
            disabled={submitting}
            required
            aria-invalid={Boolean(errors.credits)}
            aria-describedby={
              errors.credits ? "course-credits-error" : undefined
            }
          />
          {errors.credits && (
            <p className="course-field-error" id="course-credits-error">
              {errors.credits}
            </p>
          )}
        </div>

        <div className="course-field">
          <label htmlFor="course-capacity">
            Capacity
            <span className="course-required" aria-hidden="true">
              {" *"}
            </span>
          </label>
          <input
            ref={capacityRef}
            id="course-capacity"
            name="capacity"
            type="number"
            min="1"
            max="10000"
            step="1"
            value={values.capacity}
            onChange={handleChange}
            disabled={submitting}
            required
            aria-invalid={Boolean(errors.capacity)}
            aria-describedby={
              errors.capacity ? "course-capacity-error" : undefined
            }
          />
          {errors.capacity && (
            <p className="course-field-error" id="course-capacity-error">
              {errors.capacity}
            </p>
          )}
          <small className="course-field-help">
            Capacity must be a positive whole number (1–10,000) and cannot be
            lower than the current active enrollments.
          </small>
        </div>

        <div className="course-field">
          <label htmlFor="course-status">
            Status
            <span className="course-required" aria-hidden="true">
              {" *"}
            </span>
          </label>
          <select
            ref={statusRef}
            id="course-status"
            name="status"
            value={values.status}
            onChange={handleChange}
            disabled={submitting}
            aria-invalid={Boolean(errors.status)}
            // ✅ FIXED: was missing `aria-describedby` — the status
            // error was rendered but not linked to the select, so
            // SR users didn't hear it unless they Tab'd past again.
            aria-describedby={errors.status ? "course-status-error" : undefined}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
          {errors.status && (
            // ✅ FIXED: removed `role="alert"` — inconsistent with
            // other field errors (which use aria-describedby and
            // announce when focused). Only the form banner uses
            // role="alert".
            <p className="course-field-error" id="course-status-error">
              {errors.status}
            </p>
          )}
        </div>

        <div className="course-field course-field-full">
          <label htmlFor="course-description">Description</label>
          <textarea
            ref={descriptionRef}
            id="course-description"
            name="description"
            rows={4}
            maxLength={2000}
            value={values.description}
            onChange={handleChange}
            disabled={submitting}
            placeholder="Describe the course objectives and content..."
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? "course-description-error" : undefined
            }
          />
          {errors.description && (
            <p className="course-field-error" id="course-description-error">
              {errors.description}
            </p>
          )}
        </div>
      </div>

      <div className="course-form-actions">
        <button
          type="button"
          className="course-button course-button-secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="course-button course-button-primary"
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Save course"}
        </button>
      </div>
    </form>
  );
}
