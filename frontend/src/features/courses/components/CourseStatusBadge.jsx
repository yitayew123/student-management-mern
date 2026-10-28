/**
 * CourseStatusBadge — visual pill for a course's lifecycle status.
 *
 * Backend enum (Course.status): "active" | "inactive" | "archived".
 * Any other value falls back to a neutral "Unknown" display.
 *
 * Normalization:
 *   - `null` / `undefined` → "unknown" (defensive)
 *   - Whitespace trimmed (edge case: status=" active " from bad data)
 *   - Lowercased (for CSS class naming)
 *
 * A11Y:
 *   - The colored dot is decorative (`aria-hidden`) — the text label
 *     carries the meaning.
 *   - A screen-reader-only "Course status: " prefix provides context
 *     when the badge appears standalone. `sr-only` text is reliably
 *     announced by all screen readers; the previous `aria-label` on a
 *     non-focusable `<span>` was ignored by most SRs in browse mode.
 */

// Map status → display label. Same structure as
// `StudentStatusBadge.STATUS_LABELS` for consistency across the app.
// Missing keys fall through to "Unknown" (not the raw string) so
// typos / bad data degrade gracefully instead of showing lowercase.
const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

export default function CourseStatusBadge({ status }) {
  // Normalize defensively — mirrors StudentStatusBadge exactly.
  // Handles: null/undefined → "unknown", " active " → "active",
  // "ACTIVE" → "active".
  const normalized = String(status ?? "unknown")
    .trim()
    .toLowerCase();

  // 🔴 FIXED: was `?? normalized` — which showed the raw lowercase
  // string for unknown statuses (e.g., "unknown", "draft"). Now
  // always falls back to the properly-capitalized "Unknown".
  const label = STATUS_LABELS[normalized] ?? "Unknown";

  return (
    <span
      className={`course-status course-status-${normalized}`}
      // Removed aria-label — see JSDoc above. sr-only text below
      // provides the reliable equivalent.
    >
      <span className="course-status-dot" aria-hidden="true" />
      <span className="sr-only">Course status: </span>
      {label}
    </span>
  );
}
