import { forwardRef, useId } from "react";

/**
 * Textarea — multi-line input matching Input's a11y contract.
 *
 * Same plumbing as Input/Select:
 *   - useId() for stable ids
 *   - htmlFor on the label
 *   - aria-describedby combining hint + error
 *   - aria-invalid from the error prop
 *   - required HTML attribute
 *
 * Textarea-specific notes:
 *   - `rows` default is 4 (a good middle ground — 2 feels cramped,
 *     8+ wastes vertical space when empty)
 *   - Caller should pass `resize` behavior via CSS on
 *     `.form-textarea` — recommended `resize: vertical` (allows
 *     growing height, prevents horizontal overflow breaking the
 *     layout). This is a CSS concern, not a component concern.
 *   - For `maxLength` inputs, consider adding a character counter
 *     (see the note at the end) — useful UX for descriptions,
 *     comments, bio fields, etc.
 *
 * Props:
 *   label               → optional label text
 *   error               → string; when truthy, renders error + styles
 *   hint                → string; helper text below
 *   id                  → optional override for auto-generated id
 *   required            → boolean; sets required + renders asterisk
 *   rows                → number; initial visible rows (default 4)
 *   className           → applied to OUTER wrapper
 *   textareaClassName   → applied to the <textarea> (added)
 *   ref                 → forwarded to the <textarea> (added)
 *   ...props            → spread onto <textarea> (value, onChange,
 *                         maxLength, placeholder, name, disabled,
 *                         spellCheck, autoComplete, etc.)
 */
const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    hint,
    id,
    required = false,
    rows = 4,
    className = "",
    textareaClassName = "",
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const errorId = `${textareaId}-error`;
  const hintId = `${textareaId}-hint`;

  return (
    <div className={`form-field ${className}`.trim()}>
      {label && (
        <label className="form-label" htmlFor={textareaId}>
          {label}
          {required && (
            // ✅ FIXED: `aria-hidden` — same as Input/Select.
            // `required` HTML attribute already conveys requiredness.
            <span className="required-mark" aria-hidden="true">
              {" *"}
            </span>
          )}
        </label>
      )}

      <textarea
        // ✅ ADDED: forwardRef — required for React Hook Form,
        // Formik, and "focus first invalid field" patterns.
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        // ✅ ADDED: `textareaClassName` for per-field styling
        // (e.g., `.textarea--mono` for code/JSON, `.textarea--auto`
        // for auto-resize behavior).
        className={`form-control form-textarea ${
          error ? "form-control--error" : ""
        } ${textareaClassName}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        // Spread last — caller's value/onChange/maxLength/name/
        // placeholder/disabled/spellCheck win.
        {...props}
      />

      {hint && (
        <p className="form-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="form-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
});

export default Textarea;
