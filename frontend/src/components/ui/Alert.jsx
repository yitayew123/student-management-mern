import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";

/**
 * Alert — inline message with variant styling, optional title,
 * optional close button.
 *
 * Variants:
 *   info     → neutral informational message
 *   success  → operation completed
 *   warning  → caution; user should review
 *   error    → operation failed; user action likely required
 *
 * Each variant maps to BOTH a color scheme (via `.ui-alert--${variant}`
 * class) AND an ARIA live-region urgency (see ROLES below).
 */

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

/**
 * Map variant → ARIA live urgency.
 *
 * ✅ FIXED: was `role="alert"` on every variant — assertive live
 * region that INTERRUPTS the screen reader mid-sentence. Correct
 * for urgent errors and warnings, but over-aggressive for
 * informational and success messages, which aren't time-sensitive
 * and should be announced politely (after the current utterance
 * finishes).
 *
 * ARIA semantics:
 *   role="alert"  → assertive — interrupts immediately
 *   role="status" → polite    — announces at the next pause
 *
 * Per WAI-ARIA practices, assertive live regions are meant for
 * time-sensitive information only. A success toast interrupting
 * "form validation error" from a previous action is worse than
 * useless — it's actively confusing.
 */
const roles = {
  error: "alert",
  warning: "alert",
  info: "status",
  success: "status",
};

export default function Alert({ variant = "info", title, children, onClose }) {
  // ✅ FIXED: normalize the variant against the whitelist. Previously
  // an unknown variant (typo, or caller passing something new) got
  // the Info icon BUT the CSS class `ui-alert--unknown` (which has
  // no styling → falls back to `.ui-alert` base). Visual styling and
  // icon would disagree.
  //
  // Now an unknown variant is coerced to "info" entirely — icon AND
  // class AND role are all consistent.
  const safeVariant = icons[variant] ? variant : "info";
  const Icon = icons[safeVariant];
  const role = roles[safeVariant];

  return (
    <div className={`ui-alert ui-alert--${safeVariant}`} role={role}>
      <Icon className="alert-icon" size={20} aria-hidden="true" />

      <div className="alert-content">
        {title && <strong>{title}</strong>}

        {/*
          ⚠️ OPTIONAL: the extra `<div>` here is redundant — the
          `.alert-content` wrapper already provides the layout
          container. Rendering `{children}` directly would work.

          Keeping the div adds a level of nesting that's sometimes
          useful for CSS (e.g., `.alert-content > div { ... }`).
          Not a bug — just an extra node.
        */}
        {children && <div>{children}</div>}
      </div>

      {onClose && (
        <button
          type="button"
          className="alert-close"
          aria-label="Dismiss message"
          onClick={onClose}
        >
          {/*
            The X icon doesn't strictly need `aria-hidden="true"`
            because the parent button's `aria-label="Dismiss message"`
            overrides its accessible name computation — the button
            is announced as "Dismiss message, button" and the SVG
            is skipped.

            Adding `aria-hidden` is defensive (consistent with the
            main alert icon above), but not required. Leave as-is.
          */}
          <X size={17} />
        </button>
      )}
    </div>
  );
}
