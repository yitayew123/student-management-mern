import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Select — accessible dropdown field matching Input's a11y contract.
 *
 * Shares Input's plumbing:
 *   - useId() for stable ids
 *   - htmlFor on the label
 *   - aria-describedby combining hint + error
 *   - aria-invalid from the error prop
 *   - required HTML attribute
 *
 * Additional Select-specific concerns handled here:
 *   - Placeholder option is now OPTIONAL (see below)
 *   - Prevents duplicate-key React warnings when options collide
 *     with the placeholder's value
 *   - ChevronDown icon is aria-hidden (decorative)
 *
 * Props:
 *   label               → optional label text
 *   options             → array of `{ value, label }` objects.
 *                         Must be strings or numbers. Do not pass
 *                         raw strings — they won't render.
 *   error               → string; when truthy, renders error message
 *   hint                → string; helper text below
 *   id                  → optional override for auto-generated id
 *   placeholder         → string; rendered as the empty <option>.
 *                         Default "Select an option".
 *                         Pass `placeholder={null}` (or `false`) to
 *                         omit the placeholder entirely — required
 *                         for edit forms where you don't want users
 *                         accidentally resetting to empty.
 *   placeholderDisabled → boolean; makes the placeholder option
 *                         unselectable after initial load
 *                         (prevents "back to empty" behavior).
 *                         Only applies when `placeholder` is set.
 *   required            → boolean; sets required + renders asterisk
 *   className           → applied to the OUTER wrapper
 *   selectClassName     → applied to the <select> itself (added)
 *   ref                 → forwarded to the <select> (added)
 *   ...props            → spread onto <select> (value, onChange,
 *                         name, disabled, multiple, size, etc.)
 *
 * ⚠️ `multiple` and `size` are NOT officially supported. If you pass
 * them via {...props}, the native select becomes a listbox (not a
 * dropdown), but the absolute-positioned `.select-icon` overlay will
 * look wrong. Use a dedicated MultiSelect component if you need
 * multi-value selection.
 */
const Select = forwardRef(function Select(
  {
    label,
    options = [],
    error,
    hint,
    id,
    placeholder = "Select an option",
    placeholderDisabled = false,
    required = false,
    className = "",
    selectClassName = "",
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  // ✅ FIXED: only render the placeholder when it's a string.
  // Passing `placeholder={null}` or `placeholder={false}` opts out
  // — needed for edit forms where the select should show the
  // current value with no "empty" option.
  //
  // Without this, editing a student's department would show
  // "Select an option" as a selectable choice — users could
  // accidentally clear the field by re-selecting it.
  const showPlaceholder =
    typeof placeholder === "string" && placeholder.length > 0;

  // ✅ FIXED: guard against duplicate `value=""` — if the caller
  // passes an option like `{ value: "", label: "None" }` AND we
  // also render the placeholder (which uses `value=""`), React
  // produces two options with the same key warning, and the
  // browser uses the FIRST one (the placeholder) — silently
  // hiding the caller's "None" option.
  //
  // Filtering it out here means the caller's "None" wins when
  // they provide their own empty option. The placeholder is
  // automatically suppressed when this happens.
  const hasEmptyOption = options.some((opt) => opt.value === "");
  const renderPlaceholder = showPlaceholder && !hasEmptyOption;

  return (
    <div className={`form-field ${className}`.trim()}>
      {label && (
        <label className="form-label" htmlFor={selectId}>
          {label}
          {required && (
            // ✅ FIXED: `aria-hidden` — same as Input. The `required`
            // HTML attribute already announces requiredness; the
            // asterisk is a visual-only cue.
            <span className="required-mark" aria-hidden="true">
              {" *"}
            </span>
          )}
        </label>
      )}

      <div className="select-wrapper">
        <select
          // ✅ ADDED: forwardRef — required for React Hook Form,
          // Formik, and "focus first invalid field" patterns.
          ref={ref}
          id={selectId}
          // ✅ ADDED: `selectClassName` for per-field styling
          // (e.g., `.select--mono`, `.select--sm`).
          className={`form-control form-select ${
            error ? "form-control--error" : ""
          } ${selectClassName}`.trim()}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [error ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          // Spread last — caller's value/onChange/defaultValue win.
          // Caller can pass `value`, `defaultValue`, `disabled`,
          // `multiple`, `aria-label` (if no visual label), etc.
          {...props}
        >
          {/* Placeholder option — only rendered when the caller
              didn't supply their own empty option. `value=""` is the
              HTML convention for "nothing selected"; `<select required>`
              blocks submission in this state.

              When `placeholderDisabled` is true, the option is
              disabled — once the user picks a real value, they
              can't return to "Select an option" via the dropdown.
              Useful for "must pick something" flows where you want
              the placeholder visible initially but not later. */}
          {renderPlaceholder && (
            <option value="" disabled={placeholderDisabled}>
              {placeholder}
            </option>
          )}

          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* ChevronDown — visual affordance only. `aria-hidden` so
            SRs don't announce "graphic" during the select's own
            announcement ("Department, combobox, Computer Science").

            ⚠️ CSS NOTE: this icon is absolutely positioned over the
            select's right edge. `.select-icon { pointer-events: none; }`
            is required — without it, clicks on the icon area don't
            open the dropdown (they hit the icon, not the select). */}
        <ChevronDown className="select-icon" size={17} aria-hidden="true" />
      </div>

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

export default Select;
