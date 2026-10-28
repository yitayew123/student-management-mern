import { Inbox } from "lucide-react";

/**
 * EmptyState — placeholder shown when a list/table has no data.
 *
 * Common use cases:
 *   - Fresh list with no records yet ("No students yet")
 *   - Search/filter that returned nothing ("No matches for 'xyz'")
 *   - Permission-restricted view ("You don't have access")
 *
 * A11y notes:
 *   - The icon is decorative — `aria-hidden="true"` (same pattern
 *     as Alert/Spinner).
 *   - The `<h3>` heading anchors the region semantically. Callers
 *     embedding EmptyState inside an existing `<h2>` section still
 *     land on `<h3>` — acceptable. If you need a different level
 *     (e.g., `<h2>` for a full-page empty state), the caller can
 *     pass `role="region"` + a custom `<h2>` inside `action` — or
 *     we add a `headingLevel` prop later if a need appears.
 *   - For DYNAMIC empty states (result of a search, not initial
 *     page load), consider passing `role="status"` via props so
 *     screen readers announce the state change. See note below.
 *
 * Props:
 *   icon        → Lucide icon component (default: Inbox)
 *   title       → heading text (default: "Nothing to display")
 *   description → body text (default: generic message)
 *   action      → optional React node — usually a Button
 *                 ("Add Student", "Clear filters", etc.)
 *   className   → extra classes on the wrapper (layout overrides)
 *   ...props    → spread onto the root div (id, role, aria-*,
 *                 data-testid, etc.)
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing to display",
  description = "There are no records to show right now.",
  action,
  className = "",
  ...props
}) {
  return (
    // ✅ ADDED: `className` + `{...props}` passthrough. Matches every
    // other UI primitive (Button/Input/Select/Textarea/Alert/Spinner).
    // Enables:
    //   - <EmptyState className="mt-8" /> for per-use spacing
    //   - <EmptyState id="students-empty" aria-labelledby="..." />
    //   - <EmptyState data-testid="empty" /> for tests
    //   - <EmptyState role="status" /> for dynamic announcements
    <div className={`empty-state ${className}`.trim()} {...props}>
      <div className="empty-state-icon">
        {/* ✅ ADDED: `aria-hidden="true"` — Lucide renders an inline
            SVG; different screen readers announce it as "graphic",
            "image", or nothing depending on browser. The icon conveys
            NO information the title doesn't already convey. Hiding
            it makes the announcement clean: "No students yet,
            heading level 3" without a phantom "graphic" interjection. */}
        <Icon size={27} strokeWidth={1.7} aria-hidden="true" />
      </div>

      <h3>{title}</h3>
      <p>{description}</p>

      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
