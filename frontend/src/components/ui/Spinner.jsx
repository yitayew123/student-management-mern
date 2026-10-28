/**
 * Spinner — loading indicator with a screen-reader announcement.
 *
 * Sizes: sm, md, lg (default "md").
 *
 * A11Y NOTES:
 *
 *   `role="status"` implies `aria-live="polite"` — the ARIA spec is
 *   explicit that the explicit attribute is unnecessary. Removing it
 *   is a small noise reduction, not a behavior change.
 *
 *   ⚠️ LIVE-REGION CAVEAT: mounting a live region with content is
 *   NOT guaranteed to be announced by all screen readers (specifically
 *   VoiceOver iOS and TalkBack). If your app needs reliable "Loading…"
 *   announcements on mobile, the robust pattern is a PERSISTENT live
 *   region mounted at the app root whose textContent is updated —
 *   not a conditional spinner that mounts with content.
 *
 *   Example setup in AppShell.jsx:
 *     <div
 *       id="global-status"
 *       role="status"
 *       aria-live="polite"
 *       className="sr-only"
 *     />
 *
 *   Then have the loading logic update `#global-status.textContent`.
 *   This ensures the live region exists BEFORE any announcement.
 *
 *   For a desktop-focused dashboard this nuance is minor — the current
 *   pattern is announced by NVDA/JAWS. Worth flagging if accessibility
 *   audits become a concern.
 *
 * Props:
 *   label      → text shown below the spinner AND announced to SRs.
 *                Pass "Loading students…", "Saving…", etc. for
 *                better context than the default "Loading".
 *   size       → "sm" | "md" | "lg". Unknown values fall back to "md".
 *   className  → extra classes on the wrapper (for layout/margin).
 */
export default function Spinner({
  label = "Loading",
  size = "md",
  className = "",
}) {
  // ✅ ADDED: validate size against known values. Same class of fix
  // as Alert's variant normalization — an unknown size (typo, or
  // caller passing something new) previously produced an unstyled
  // class `spinner--unknown` with no CSS, resulting in an invisible
  // or default-styled spinner. Silent failure.
  const safeSize = ["sm", "md", "lg"].includes(size) ? size : "md";

  return (
    // ⚠️ REMOVED: `aria-live="polite"` — redundant with role="status".
    // Keeping it doesn't break anything, but the ARIA spec is
    // explicit it's unnecessary. Removing it also prevents any edge
    // case where a future refactor might double-announce if both
    // role and aria-live somehow take effect independently.
    //
    // ✅ ADDED: `className` passthrough for per-use layout overrides
    // (centering, margin, full-screen "page loader" variant). Matches
    // Button/Input/Select/Textarea/Alert — the earlier UI primitives
    // all support this pattern.
    <div className={`spinner-container ${className}`.trim()} role="status">
      {/* Visual spinner — `aria-hidden` because the announcement
          is the label text, not the animation itself. SRs skip the
          decorative spinning graphic. */}
      <span className={`spinner spinner--${safeSize}`} aria-hidden="true" />

      {/* The text label — this is what gets announced. For most
          use cases, keep it visible; for inline-in-a-table-row
          usage, the caller can hide it via `.spinner-label`
          styling or by passing a shorter label like "Loading…". */}
      <span className="spinner-label">{label}</span>
    </div>
  );
}
