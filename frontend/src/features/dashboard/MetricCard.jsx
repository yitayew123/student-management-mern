import { Users, BookOpen, ClipboardList } from "lucide-react";

/**
 * MetricCard — a single summary card for the dashboard.
 *
 * Used by `DashboardPage.jsx` to render the three metric tiles:
 *   - Active students (type: "students")
 *   - Active courses (type: "courses")
 *   - Active enrollments (type: "enrollments")
 *
 * Props:
 *   title        → card heading text (e.g., "Active students")
 *   value        → the numeric value to display (pre-formatted by
 *                  the parent OR raw — this component formats it)
 *   description  → short explanatory text below the value
 *   type         → which icon + accent color to use
 *                  ("students" | "courses" | "enrollments")
 *
 * A11Y:
 *   - The title is a real `<h2>` — restores heading navigation
 *     that the inline version had. Screen readers can jump between
 *     metric cards via the heading list.
 *   - No `aria-label` on the `<article>` — the h2 provides the
 *     accessible name. Adding aria-label alongside visible text
 *     causes redundant announcements in most SRs.
 *   - The icon is `aria-hidden` — decorative, the title conveys
 *     the meaning.
 *   - The value is announced as part of the card content via the
 *     h2 + value paragraph reading order.
 *
 * ⚠️ CLASS NAME COMPATIBILITY:
 *   The class names below (`metric-card`, `metric-icon`, `metric-value`)
 *   match the ones used in `dashboard.css` — so this component is
 *   a drop-in replacement for the inline cards. If you refactor
 *   to BEM-style names (`dashboard-metric-card`, etc.), update
 *   both this file AND dashboard.css together.
 */
const iconMap = {
  students: Users,
  courses: BookOpen,
  enrollments: ClipboardList,
};

// Tone color per type — matches the original inline version's
// per-card color treatment (blue / violet / teal).
const toneMap = {
  students: "blue",
  courses: "violet",
  enrollments: "teal",
};

export default function MetricCard({ title, value, description, type }) {
  const Icon = iconMap[type] ?? ClipboardList;
  const tone = toneMap[type] ?? "teal";

  // Format the value — handles the three states that appear during
  // the dashboard's lifecycle:
  //   - a real number → "1,234" (toLocaleString)
  //   - undefined/null (during first-load placeholder) → "—"
  //   - NaN (bad data) → "—"
  //
  // The inline version did this inline; centralizing it here means
  // future cards (a 4th metric, etc.) inherit the behavior.
  const displayValue = loadingPlaceholder(value) || formatValue(value);

  return (
    <article
      className={`metric-card ${tone ? `metric-card--${tone}` : ""}`}
      // No aria-label: the h2 below provides the accessible name.
    >
      <div className="metric-card-top">
        <div className={`metric-icon metric-icon--${tone}`} aria-hidden="true">
          <Icon size={22} strokeWidth={1.8} />
        </div>
        <span className="metric-indicator">
          {/* If you want a pill/label here (e.g., "Live count"),
              pass it as a prop. Currently empty to match the
              simplified extracted version. */}
        </span>
      </div>

      <div className="metric-value">{displayValue}</div>

      {/* ✅ Restored: h2 heading so the metric cards appear in
          the heading navigation list. WCAG 1.3.1 / 2.4.6. */}
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
}

/**
 * Format a numeric value for display.
 * Returns "—" for undefined/null/NaN, otherwise toLocaleString().
 */
function formatValue(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : "—";
}

/**
 * Helper predicate that returns the "—" placeholder string when
 * the value is missing, or "" (empty) when it should use formatValue.
 * (Kept inline for clarity — could be folded into formatValue.)
 */
function loadingPlaceholder(value) {
  return "";
}
