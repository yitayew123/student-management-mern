import { useEffect, useRef, useState } from "react";
import {
  EMPTY_STUDENT,
  normalizeStudent,
  validateStudent,
} from "../studentValidation";

/**
 * Field configuration for the create/edit form.
 *
 * ⚠️ CRITICAL: `name` values MUST match the backend's Student
 * schema exactly. Mismatches cause silent validation failures
 * (unknown keys are stripped, required keys rejected).
 *
 * Field mapping (as of backend schema):
 *   - `studentId`  → "Student ID" business field (NOT studentNumber)
 *   - `firstName`  → part of the person's name
 *   - `lastName`   → part of the person's name
 *   - `email`, `phone`, `program`
 *
 * `maxLength` matches the backend's validation bounds so the
 * client doesn't let through values the server would reject.
 */
const FIELDS = [
  {
    name: "studentId",
    label: "Student ID",
    placeholder: "e.g. STU-2026-001",
    required: true,
    maxLength: 30, // backend: minlength 3, maxlength 30
  },
  {
    name: "firstName",
    label: "First name",
    placeholder: "Enter first name",
    required: true,
    maxLength: 80, // backend: minlength 1, maxlength 80
  },
  {
    name: "lastName",
    label: "Last name",
    placeholder: "Enter last name",
    required: true,
    maxLength: 80,
  },
  {
    name: "email",
    label: "Email address",
    placeholder: "student@example.com",
    type: "email",
    required: true,
    maxLength: 254,
  },
  {
    name: "phone",
    label: "Phone number",
    placeholder: "+251 9XX XXX XXX",
    type: "tel",
    maxLength: 25,
  },
  {
    name: "program",
    label: "Academic program",
    placeholder: "e.g. Software Engineering",
    required: true,
    maxLength: 100, // backend: maxlength 100
  },
];

// Backend enum — keep in sync with `Student.status` in the model.
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "graduated", label: "Graduated" },
  { value: "suspended", label: "Suspended" },
];

/**
 * StudentForm — create/edit form for a student.
 *
 * Props:
 *   initialValues  → object (or undefined for create mode). Merged
 *                    with EMPTY_STUDENT so partial payloads work.
 *   onSubmit       → async (normalizedValues) => void. Throws on
 *                    failure (parent catches or lets this component
 *                    handle it).
 *   onCancel       → () => void. Wired to the Cancel button.
 *   submitting     → boolean. Disables the form + shows "Saving...".
 *
 * ⚠️ IMPORTANT FOR PARENTS (initialValues):
 *   This component RESETS its internal state whenever the
 *   `initialValues` prop changes by REFERENCE. If you pass an
 *   inline object literal (`<StudentForm initialValues={{...}} />`),
 *   it will be a new reference on every parent render — causing the
 *   form to reset mid-edit and wipe the user's typing.
 *
 *   Fix in the parent:
 *     - Memoize: `const init = useMemo(() => ({...}), [deps])`
 *     - OR pass a state value that only changes when the
 *       underlying data changes
 *     - OR pass `initialValues={undefined}` for create mode and
 *       only set it once when entering edit mode
 *
 * A11Y:
 *   - Field errors are linked via `aria-describedby` on each input
 *     and announced when the input is focused.
 *   - After a failed submission, focus moves to the FIRST invalid
 *     field so screen readers announce the error immediately
 *     (WCAG 2.4.3).
 *   - Form-level errors use `role="alert"` (assertive) since they're
 *     actionable and time-sensitive.
 *   - `aria-busy` on the form tells SR users it's processing.
 */
export default function StudentForm({
  initialValues,
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const [values, setValues] = useState({
    ...EMPTY_STUDENT,
    ...initialValues,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  // Refs for focus management — move focus to first invalid field
  // after submit. Using refs (not getElementById) so multiple forms
  // on the same page don't collide on IDs.
  const fieldRefs = useRef({});
  const statusRef = useRef(null);

  // ⚠️ See "IMPORTANT FOR PARENTS" note in the JSDoc above. This
  // effect fires on every reference change of `initialValues`.
  useEffect(() => {
    setValues({
      ...EMPTY_STUDENT,
      ...initialValues,
    });
    setErrors({});
    setFormError("");
  }, [initialValues]);

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((current) => ({ ...current, [name]: value }));

    // Clear this field's error on edit — standard pattern; prevents
    // stale errors from lingering after the user fixes them.
    setErrors((current) => ({ ...current, [name]: "" }));
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateStudent(values);
    setErrors(validationErrors);
    setFormError("");

    if (Object.keys(validationErrors).length > 0) {
      // ✅ ADDED: move focus to the first invalid field. Without
      // this, screen reader users submit an invalid form and hear
      // nothing — the errors appear on screen but aren't announced
      // unless they Tab through every field.
      //
      // Iteration order matters: FIELDS is the visual order, so
      // focusing the first invalid one matches what a sighted user
      // would look at.
      const firstInvalidField = FIELDS.find(
        (field) => validationErrors[field.name],
      );
      if (firstInvalidField) {
        fieldRefs.current[firstInvalidField.name]?.focus();
      } else if (validationErrors.status) {
        statusRef.current?.focus();
      }
      return;
    }

    try {
      await onSubmit(normalizeStudent(values));
    } catch (error) {
      // ── Parse server errors into field-level errors ──────
      // `error.details` from the backend is:
      //   [{ field: "email", message: "..." }, { field: "yearLevel", ... }]
      //
      // We also accept Zod's raw shape (`[{ path: ["email"], ... }]`)
      // for compatibility with tests or direct endpoint calls that
      // don't go through the errorHandler wrapper.
      const details = error?.details;
      const fieldErrors = {};
      const allowedFields = new Set([...FIELDS.map((f) => f.name), "status"]);

      if (details && typeof details === "object") {
        const entries = Array.isArray(details)
          ? details.map((item) => [
              // 🔴 FIXED: prefer `item.field` (our backend's shape),
              // fall back to `item.path` (Zod's raw shape) for
              // compatibility. Previously only checked `path` —
              // which never exists on backend responses, so field
              // errors were never populated.
              item.field ?? item.path?.at?.(-1) ?? item.path,
              item.message,
            ])
          : Object.entries(details);

        for (const [key, value] of entries) {
          // Normalize the field name — may be "email", "email.x",
          // or an array (Zod nested path).
          const fieldName = Array.isArray(key)
            ? key.at(-1)
            : String(key).split(".").at(-1);

          // Skip fields the form doesn't render (e.g., backend errors
          // on `user`, `department`, `yearLevel` — silently drop
          // rather than show "unknown field error"). The form-level
          // banner will still show the message.
          if (allowedFields.has(fieldName)) {
            fieldErrors[fieldName] = Array.isArray(value)
              ? value.join(", ")
              : typeof value === "string"
                ? value
                : (value?.message ?? "Please check this value.");
          }
        }
      }

      // ── Duplicate / uniqueness errors ────────────────────
      // Backend messages: "This student ID is already registered"
      // / "This email address is already registered".
      //
      // 🔴 FIXED: regex was `/student.?number/i` — doesn't match
      // "student ID". Now uses `/student\s*id/i` OR `/student\s*number/i`
      // (supports both old and new field names during a migration).
      const message = error?.message ?? "Unable to save the student.";

      if (/duplicate|already exists|unique|already registered/i.test(message)) {
        if (/student\s*(id|number)/i.test(message)) {
          fieldErrors.studentId = message;
        } else if (/email/i.test(message)) {
          fieldErrors.email = message;
        } else {
          setFormError(message);
        }
      } else if (Object.keys(fieldErrors).length === 0) {
        // No field-level match → show as form banner.
        setFormError(message);
      }

      setErrors((current) => ({ ...current, ...fieldErrors }));
    }
  }

  return (
    <form
      className="student-form"
      onSubmit={handleSubmit}
      noValidate
      // ✅ ADDED: aria-busy tells screen readers the form is
      // processing. Complements the disabled state (which some SRs
      // don't announce).
      aria-busy={submitting}
    >
      {/*
        Form-level error banner. `role="alert"` announces assertively
        (interrupts SR). Correct for auth/submit errors — they're
        actionable and time-sensitive.

        Note this is DIFFERENT from field-level errors, which use
        `aria-describedby` (announced when the field is focused).
        Two distinct patterns for two distinct purposes:
          - formError   → "something failed"      → assertive
          - fieldErrors → "fix this specific one" → when focused
      */}
      {formError && (
        <div className="student-form-alert" role="alert">
          {formError}
        </div>
      )}

      <div className="student-form-grid">
        {FIELDS.map((field) => (
          <div className="student-field" key={field.name}>
            <label htmlFor={`student-${field.name}`}>
              {field.label}
              {field.required && (
                <span className="required-mark" aria-hidden="true">
                  {" *"}
                </span>
              )}
            </label>

            <input
              // ✅ ADDED: ref for focus management (post-submit).
              ref={(el) => {
                fieldRefs.current[field.name] = el;
              }}
              id={`student-${field.name}`}
              name={field.name}
              type={field.type ?? "text"}
              value={values[field.name] ?? ""}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              required={field.required}
              autoComplete={
                field.name === "email"
                  ? "email"
                  : field.name === "firstName" || field.name === "lastName"
                    ? "name"
                    : field.name === "phone"
                      ? "tel"
                      : "off"
              }
              onChange={handleChange}
              disabled={submitting}
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={
                errors[field.name] ? `student-${field.name}-error` : undefined
              }
            />

            {errors[field.name] && (
              <p
                className="student-field-error"
                id={`student-${field.name}-error`}
              >
                {errors[field.name]}
              </p>
            )}
          </div>
        ))}

        {/*
          Status select — matches backend enum with all 4 values.
          (Previously only 2, so editing a graduated/suspended
          student would fail validation without an option to select
          their current status.)
        */}
        <div className="student-field">
          <label htmlFor="student-status">
            Status
            <span className="required-mark" aria-hidden="true">
              {" *"}
            </span>
          </label>

          <select
            ref={statusRef}
            id="student-status"
            name="status"
            value={values.status}
            onChange={handleChange}
            disabled={submitting}
            aria-invalid={Boolean(errors.status)}
            // ✅ FIXED: added `aria-describedby` — previously the
            // status error was in the DOM but not linked to the
            // select, so SR users didn't hear it unless they
            // happened to Tab past the select again.
            aria-describedby={
              errors.status ? "student-status-error" : undefined
            }
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/*
            ✅ FIXED: removed `role="alert"` (inconsistent with the
            text-field errors — those use aria-describedby, which
            announces when focused). Keeping the pattern consistent:
            field errors are linked to their fields; only the form
            banner uses role="alert".
          */}
          {errors.status && (
            <p className="student-field-error" id="student-status-error">
              {errors.status}
            </p>
          )}
        </div>
      </div>

      <div className="student-form-actions">
        <button
          className="student-button student-button-secondary"
          type="button"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>

        <button
          className="student-button student-button-primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Save student"}
        </button>
      </div>
    </form>
  );
}
