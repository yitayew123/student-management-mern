import { forwardRef, useId } from "react";

/**
 * Input — form field with label, hint, and error slots.
 *
 * Handles the a11y plumbing most inputs get wrong:
 *   - `useId()` generates a stable id (SSR-safe)
 *   - `<label htmlFor>` associates label with input
 *   - `aria-describedby` links hint + error to the input
 *   - `aria-invalid` set from the `error` prop
 *   - `required` HTML attribute announces requiredness
 *
 * Props:
 *   label           → optional label text
 *   error           → string; when truthy, renders error message
 *                     and applies `.form-control--error`
 *   hint            → string; helper text below the field
 *   id              → optional override for the auto-generated id
 *   required        → boolean; sets `required` + renders asterisk
 *   className       → applied to the OUTER wrapper (`.form-field`)
 *                     — see note below
 *   inputClassName  → applied to the `<input>` itself (added)
 *   ref             → forwarded to the `<input>` (added)
 *   ...props        → spread onto `<input>` (type, value, onChange,
 *                     name, placeholder, autoComplete, etc.)
 *
 * ⚠️ IMPORTANT — where `className` goes:
 *   This component puts `className` on the WRAPPER (`.form-field`),
 *   NOT on the `<input>`. That matches the existing convention
 *   (callers use `className="col-span-2"` for grid layout), but
 *   it can surprise a caller who expects `<Input className="foo" />`
 *   to add a class to the input element. If you want to style the
 *   input itself, use `inputClassName` (newly added, backward
 *   compatible — existing callers unaffected).
 *
 * ⚠️ forwardRef is required for form focus management:
 *   When a form submission fails validation, you typically want to
 *   `.focus()` the first invalid field. Without a forwarded ref,
 *   that's impossible from the parent:
 *
 *     const emailRef = useRef(null);
 *     if (!valid) emailRef.current?.focus();
 *     <Input label="Email" ref={emailRef} error={errors.email} />
 *
 *   The same ref is required by third-party libs (React Hook Form,
 *   Formik, React Aria, Headless UI).
 */
const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    id,
    required = false,
    className = "",
    inputClassName = "",
    ...props
  },
  ref,
) {
  // Stable, SSR-safe id. `id` prop can override (rare — most callers
  // rely on the auto-generated id, which is what `useId` is for).
  const generatedId = useId();
  const inputId = id || generatedId;

  // Derived ids for the error/hint elements — used by
  // `aria-describedby`. Prefixing with `inputId` guarantees uniqueness
  // even if multiple inputs on the page have hints/errors.
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    // `.trim()` strips the trailing space that `${className}` adds
    // when the caller omits it — cosmetic but keeps the DOM string
    // clean (`"form-field "` → `"form-field"`).
    <div className={`form-field ${className}`.trim()}>
      {label && (
        <label className="form-label" htmlFor={inputId}>
          {label}
          {required && (
            // ✅ FIXED: `aria-hidden="true"` on the asterisk — the
            // visual cue for sighted users ("this field is required")
            // should NOT be read aloud as "asterisk" by screen
            // readers. The `required` attribute on the input already
            // announces requiredness ("Email, required, edit text").
            // Without this, SRs read "Email asterisk, required, edit
            // text" — mildly confusing, and worse in some languages
            // where "asterisk" is a long word.
            <span className="required-mark" aria-hidden="true">
              {" *"}
            </span>
          )}
        </label>
      )}

      <input
        // ✅ ADDED: `ref` forwarded from the parent — enables
        // `.focus()` for validation workflows, React Hook Form
        // integration, and autofocus-after-close-dialog patterns.
        ref={ref}
        id={inputId}
        // ✅ ADDED: `inputClassName` — lets callers add classes to
        // the input element itself (e.g., `.input--mono` for code
        // fields, `.input--sm` for compact rows). Backward
        // compatible: existing calls that don't pass it are
        // unaffected.
        className={`form-control ${error ? "form-control--error" : ""} ${inputClassName}`.trim()}
        required={required}
        // `Boolean(error)` handles `false`, `null`, `undefined`, `""`,
        // and any string — all falsy → `aria-invalid="false"`.
        // When error is a string → "true" (aria-invalid only allows
        // "true" / "false" / "grammar" / "spelling" — boolean values
        // are converted automatically by React, so this is correct).
        aria-invalid={Boolean(error)}
        // `aria-describedby` combines hint + error ids into a
        // space-separated list. Screen readers announce both
        // descriptions in order — error first, then hint, matching
        // the visual order.
        //
        // The `.filter(Boolean).join(" ") || undefined` pattern:
        //   - When both exist: "id-error id-hint"
        //   - When only error: "id-error"
        //   - When only hint:  "id-hint"
        //   - When neither:    undefined (attribute omitted entirely)
        //
        // Omitting the attribute (vs. empty string) is important —
        // `aria-describedby=""` is technically invalid and some SRs
        // announce "described by" with nothing following.
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        // Spread LAST so caller-supplied attributes (`type`, `value`,
        // `onChange`, `name`, `placeholder`, `autoComplete`,
        // `maxLength`, `data-*`, `onBlur`, etc.) can override any
        // defaults. This is the standard React pattern — explicit
        // props win, but computed defaults are the fallback.
        {...props}
      />

      {/* Hint renders AFTER the input so screen readers see it
          after the input in DOM order — matching the visual order
          (input, then hint, then error). */}
      {hint && (
        <p className="form-hint" id={hintId}>
          {hint}
        </p>
      )}

      {/* Error renders last — visually below the hint — so the
          most-recent feedback is at the bottom. Also announced
          last by SRs, which matches "something is wrong with what
          you just typed." */}
      {error && (
        <p className="form-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
