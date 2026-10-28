/**
 * EnrollmentStatusBadge — visual pill for an enrollment's lifecycle
 * status.
 *
 * Backend enum (Enrollment.status): "enrolled" | "completed" |
 * "cancelled" | "dropped" | "withdrawn". Any other value falls back
 * to "Unknown".
 *
 * Normalization:
 *   - `null` / `undefined` → "unknown" (defensive)
 *   - Whitespace trimmed (edge case: status=" enrolled " from bad data)
 *   - Lowercased (for CSS class naming)
 *
 * A11Y:
 *   - The colored dot is decorative (`aria-hidden`) — the text
 *     label carries the meaning.
 *   - A screen-reader-only "Enrollment status: " prefix provides
 *     context when the badge appears standalone. `sr-only` text is
 *     reliably announced by all screen readers; the previous
 *     `aria-label` on a non-focusable `<span>` was ignored by most
 *     SRs in browse mode.
 *
 * ⚠️ ENUM CRITICAL — the labels map MUST match `Enrollment.status`
 * in `backend/src/models/Enrollment.js`. Wrong keys here are worse
 * than missing keys:
 *   - Missing keys → falls through to "Unknown" (safe)
 *   - Wrong keys   → dead code that misleads future developers
 *                    into thinking invalid statuses exist
 *
 * If the backend enum ever changes, update BOTH:
 *   1. This `STATUS_LABELS` map
 *   2. The `.enrollment-status-*` CSS classes (see enrollment CSS)
 */
const STATUS_LABELS = {
  enrolled: "Enrolled",
  completed: "Completed",
  cancelled: "Cancelled",
  dropped: "Dropped",
  withdrawn: "Withdrawn",
};

export default function EnrollmentStatusBadge({ status }) {
  // Normalize defensively — same pattern as StudentStatusBadge /
  // CourseStatusBadge. Handles null/undefined → "unknown",
  // " enrolled " → "enrolled", "ENROLLED" → "enrolled".
  const normalized = String(status ?? "unknown")
    .trim()
    .toLowerCase();

  // 🔴 FIXED: was `labels[normalized] ?? normalized` — which
  // showed the raw lowercase string for unknown values. Combined
  // with the wrong enum keys (missing "dropped"/"withdrawn"),
  // this rendered those two statuses in lowercase. Now falls
  // back to "Unknown" (capitalized) so bad data degrades
  // gracefully.
  const label = STATUS_LABELS[normalized] ?? "Unknown";

  return (
    <span className={`enrollment-status enrollment-status-${normalized}`}>
      <span className="enrollment-status-dot" aria-hidden="true" />
      {/* ✅ ADDED: sr-only prefix — reliably announces as
          "Enrollment status: Enrolled" (or whichever) across all
          screen readers. Replaces the previous `aria-label` which
          was ignored by NVDA/JAWS/VoiceOver in browse mode. */}
      <span className="sr-only">Enrollment status: </span>
      {label}
    </span>
  );
}
