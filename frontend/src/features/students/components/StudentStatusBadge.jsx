/**
 * StudentStatusBadge — visual pill for a student's lifecycle status.
 *
 * Backend enum (Student.status): "active" | "inactive" | "graduated" | "suspended".
 * Any other value falls back to a neutral "Unknown" display.
 *
 * Normalization:
 *   - `null` / `undefined` → "unknown" (defensive — never render "null")
 *   - Whitespace trimmed (edge case: status=" active " from bad data)
 *   - Lowercased (matches CSS class naming convention)
 *
 * A11Y:
 *   - The colored dot is decorative (`aria-hidden`), the text label
 *     carries the meaning.
 *   - A screen-reader-only "Student status: " prefix gives context
 *     when the badge appears standalone (e.g., in a card). If the
 *     surrounding context already provides "Status" (like a table
 *     column), the prefix is redundant but harmless.
 *   - This replaced the previous `aria-label` approach because
 *     `aria-label` on a non-focusable `<span>` is inconsistently
 *     announced across screen readers — most ignore it in browse
 *     mode. `sr-only` text is always read.
 */

// Map status → display label. Missing keys fall through to "Unknown"
// (defined in the badge below), which prevents raw strings from
// leaking into the UI (e.g., "activ" from a typo would show as
// "activ" — better to show "Unknown" and let the admin investigate).
const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  graduated: "Graduated",
  suspended: "Suspended",
};

export default function StudentStatusBadge({ status }) {
  // Normalize defensively:
  //   - `String(status ?? "unknown")` handles null/undefined without
  //     producing "null" or "undefined" as the class name
  //   - `.trim()` prevents " active " (with spaces) from producing a
  //     broken CSS class like `student-status- active `
  //   - `.toLowerCase()` normalizes case for both the class AND the
  //     label lookup
  const normalized = String(status ?? "unknown")
    .trim()
    .toLowerCase();

  // Fallback to "Unknown" (capitalized) instead of the raw lowercase
  // string, so typos / future enum values degrade gracefully.
  const label = STATUS_LABELS[normalized] ?? "Unknown";

  return (
    <span
      className={`student-status student-status-${normalized}`}
      // Removed aria-label (see JSDoc above). sr-only text below
      // provides the reliable equivalent.
    >
      <span className="student-status-dot" aria-hidden="true" />
      <span className="sr-only">Student status: </span>
      {label}
    </span>
  );
}
