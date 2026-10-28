import { forwardRef } from "react";
import { LoaderCircle } from "lucide-react";

/**
 * Button — the one button component used everywhere.
 *
 * Variants: primary, secondary, outline, danger, ghost
 * Sizes:    sm, md, lg
 *
 * Defaults match user expectations:
 *   - `type="button"` — avoids the classic "button inside form
 *     submits the form" bug (native <button> defaults to `submit`)
 *   - `disabled = disabled || loading` — prevents double-submits
 *     while a request is in-flight (a user pressing Enter twice
 *     would otherwise send two POSTs)
 *   - className passthrough — allows per-use overrides without
 *     needing a new variant
 *
 * Wrapped in `forwardRef` so parent components can call
 * `.focus()` / `.blur()` on it — required when buttons appear in
 * dialogs (focus restoration on close), tooltips (anchor refs),
 * or any Radix/Headless UI trigger using `asChild`.
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    type = "button", // ← prevents accidental form submission
    className = "",
    ...props
  },
  ref,
) {
  // Compute the spinner size from the button size so visual weight
  // stays proportional. A 17px spinner in a 28px-tall "sm" button
  // looks oversized; a 14px spinner in a 48px-tall "lg" button
  // looks lost.
  const spinnerSize = size === "sm" ? 14 : size === "lg" ? 20 : 17;

  return (
    <button
      // ✅ FIXED: forwardRef + `ref` prop — enables `.focus()` on
      // the button from parent components. Without this, focus
      // management in dialogs/modals/forms is blocked.
      ref={ref}
      type={type}
      // Computed className includes variant + size + caller's
      // override. `.trim()` strips the trailing space that
      // `${className}` adds when className is `""` — cosmetic but
      // keeps the DOM clean.
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`.trim()}
      // `disabled` also fires when loading — prevents double-submit.
      disabled={disabled || loading}
      // ✅ FIXED: `aria-busy` tells screen readers the button is
      // processing. Without it, a SR user who hits "Save" hears
      // nothing until the network call finishes — sometimes many
      // seconds of silence. `undefined` (not `false`) removes the
      // attribute entirely when idle, matching WCAG guidance.
      //
      // Placed BEFORE `{...props}` — but since `aria-busy` can't be
      // destructured out (it's not a named prop), this is
      // technically overridable via props. In practice no caller
      // passes it — the derived value is always correct.
      aria-busy={loading ? "true" : undefined}
      {...props}
    >
      {/*
        ✅ FIXED: `aria-hidden="true"` on the spinner — the SVG has
        no text content, but screen readers may still announce it
        as an unlabeled graphic ("image" or "button"). Marking it
        hidden suppresses that. Standard pattern for any decorative
        icon inside an interactive element.

        The spinner is rendered BEFORE `{children}` so it appears
        on the left of the text. Keeping children visible during
        loading (rather than replacing them with "Loading...")
        preserves layout stability — the button doesn't grow or
        shrink when a request starts.
      */}
      {loading && (
        <LoaderCircle className="spin" size={spinnerSize} aria-hidden="true" />
      )}
      {children}
    </button>
  );
});

export default Button;
