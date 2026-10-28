/**
 * CourseCapacity — enrollment progress bar with count summary.
 *
 * Displays:
 *   - "enrolled / capacity" numeric summary
 *   - Remaining seats count (unless compact)
 *   - Progress bar (capped at 100% width for visual)
 *
 * Props:
 *   course   — full course object. Uses the first available of:
 *              `activeEnrollmentCount`, `enrolledCount`,
 *              `enrollmentCount`, `capacity`.
 *   compact  — boolean; hides the "X seats left" text (used in
 *              tables where space is tight).
 *
 * A11Y:
 *   - `role="progressbar"` with `aria-valuemin`, `aria-valuemax`,
 *     `aria-valuenow` for the numeric state.
 *   - `aria-valuetext` overrides the announcement with the FULL
 *     count when over-capacity — SR users hear "35 enrolled of 30
 *     seats (over capacity)" instead of the misleading "30 of 30".
 *   - `aria-label` includes the course code / title so multiple
 *     capacity bars on the same page are distinguishable.
 *
 * EDGE CASES HANDLED:
 *   - Unknown enrolled count → shows "{capacity} seats" (or "— seats"
 *     if capacity is also unknown)
 *   - Non-finite capacity → "— seats"
 *   - Negative enrolled (bad data) → clamped to 0, no invalid CSS
 *   - Over-capacity (enrolled > capacity) → visually distinct via
 *     `is-over` class + accurate ARIA text
 *   - Zero capacity → 0% width (guarded against divide-by-zero)
 */
export default function CourseCapacity({ course, compact = false }) {
  // Try several field names — backend may have evolved, or different
  // endpoints may return different shapes. Falls back to null if none
  // are present (so we can render "capacity only" mode).
  const enrolled =
    course.activeEnrollmentCount ??
    course.enrolledCount ??
    course.enrollmentCount ??
    null;

  // Coerce to number once. If `course.capacity` is "30" (string),
  // this becomes 30. If undefined/null/garbage, becomes NaN.
  const capacity = Number(course.capacity);

  // ── Unavailable branch ─────────────────────────────────────
  // Renders when either enrolled count is unknown OR capacity is
  // not a valid number. Shows capacity alone when we have it, else
  // "— seats".
  if (enrolled === null || !Number.isFinite(capacity)) {
    return (
      <span className="course-capacity-unavailable">
        {Number.isFinite(capacity) ? capacity : "—"} seats
      </span>
    );
  }

  const rawCount = Number(enrolled);
  // 🔴 FIXED: was `Number.isFinite(count) ? count : 0` — no lower
  // bound. If enrolled is negative (bad data), safeCount was
  // negative → percentage went negative → invalid CSS width +
  // invalid aria-valuenow (< aria-valuemin=0).
  // Now clamped to [0, ∞) so both CSS and ARIA stay valid.
  const safeCount = Number.isFinite(rawCount) ? Math.max(0, rawCount) : 0;

  // Remaining seats — Math.max handles the "at or over capacity"
  // case (returns 0, no negative "seat" count).
  const remaining = Math.max(0, capacity - safeCount);

  // Percentage — used ONLY for the visual fill width. Capped at 100
  // so the bar never overflows its track. The actual numbers (in the
  // summary and aria-valuetext) reflect the true values.
  const percentage =
    capacity > 0 ? Math.min(100, (safeCount / capacity) * 100) : 0;

  // Whether the course is at or over capacity (for summary text).
  const isFull = safeCount >= capacity;
  // Whether it's strictly OVER capacity (for the "over by N" message
  // and the is-over visual class).
  const isOver = safeCount > capacity;
  const overBy = isOver ? safeCount - capacity : 0;

  // Course identifier for the aria-label — falls back to "Course"
  // if neither code nor title is available (defensive for edge cases
  // like partial data during optimistic updates).
  const courseIdentifier = course.courseCode ?? course.title ?? "Course";

  return (
    <div className="course-capacity">
      <div className="course-capacity-summary">
        <strong>
          {/* toLocaleString formats 10000 as "10,000" — matches the
              formatting used in DashboardPage metric cards. */}
          {safeCount.toLocaleString()} / {capacity.toLocaleString()}
        </strong>

        {!compact && (
          <span
            // Color-code the summary text based on state — visual
            // reinforcement of the is-full / is-over state.
            className={
              isOver
                ? "course-capacity-over"
                : isFull
                  ? "course-capacity-full"
                  : undefined
            }
          >
            {isOver
              ? `${overBy} over capacity`
              : isFull
                ? "Full"
                : `${remaining.toLocaleString()} seat${
                    remaining === 1 ? "" : "s"
                  } left`}
          </span>
        )}
      </div>

      <div
        className="course-capacity-track"
        role="progressbar"
        // 🔴 CHANGED: added course identifier — distinguishes multiple
        // capacity bars on the same page for screen reader users.
        aria-label={`${courseIdentifier} enrollment capacity`}
        aria-valuemin={0}
        aria-valuemax={capacity}
        // Cap at capacity so aria-valuenow stays valid per spec
        // (must be between valuemin and valuemax).
        aria-valuenow={Math.min(safeCount, capacity)}
        // 🔴 ADDED: aria-valuetext overrides the numeric announcement
        // with the FULL count + over-capacity flag when applicable.
        // This is how SR users learn about over-capacity — the raw
        // aria-valuenow is capped by spec, so the text carries the
        // truth.
        aria-valuetext={
          isOver
            ? `${safeCount} enrolled of ${capacity} seats (over capacity)`
            : `${safeCount} enrolled of ${capacity} seats`
        }
      >
        <span
          className={`course-capacity-fill ${
            isFull ? "is-full" : ""
          } ${isOver ? "is-over" : ""}`}
          style={{ width: `${percentage}%` }}
          // Decorative — SRs read the progressbar role on the parent
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
