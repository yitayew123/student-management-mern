/**
 * EnrollmentCapacity — shows a course's remaining seats and a
 * capacity progress bar. Used in the enrollment-create form to
 * help the user gauge whether the course has room before submitting.
 *
 * Handles four states:
 *   1. Available (enrolled < capacity) → "X seats available"
 *   2. Exactly full (enrolled === capacity) → "This course appears
 *      to be full." (the "appears" hedge is intentional — the count
 *      may be stale by submit time, and the server is the authority)
 *   3. Over capacity (enrolled > capacity) → "X over capacity"
 *      (a data-integrity signal — see NOTE below)
 *   4. Unknown capacity/enrolled → explanatory message ("The server
 *      will verify…") — better than showing dashes, because it tells
 *      the user what to expect when they submit
 *
 * A11Y:
 *   - `role="progressbar"` with `aria-valuemin`/`aria-valuemax`/`aria-valuenow`
 *   - `aria-valuetext` overrides the numeric announcement when over-
 *     capacity — SRs hear "35 enrolled of 30 seats (over capacity)"
 *     instead of the misleading "30 of 30"
 *
 * NOTE on over-capacity display:
 *   When enrollments exceed capacity, the underlying data has a
 *   problem (guards failed, migration bug, manual edit). Surfacing
 *   this distinctly is useful — a silent "Full" state hides a real
 *   issue that an admin should investigate.
 */
export default function EnrollmentCapacity({ course }) {
  // No course selected yet → render nothing. The form shows this
  // component only after a course is chosen.
  if (!course) return null;

  const capacity = Number(course.capacity);

  // 🔴 FIXED: clamp enrolled to non-negative. Number(null) is 0
  // (fine), but negative values from bad data would break the CSS
  // width and mislead the "available" computation. Clamping here
  // means all downstream math (available, percentage, aria-valuenow)
  // operates on a sane value.
  const rawEnrolled = Number(
    course.activeEnrollmentCount ??
      course.enrolledCount ??
      course.enrollmentCount,
  );
  const enrolled = Number.isFinite(rawEnrolled)
    ? Math.max(0, rawEnrolled)
    : NaN;

  const hasCount = Number.isFinite(enrolled);
  const hasCapacity = Number.isFinite(capacity) && capacity > 0;

  // `available` is clamped to 0 so "over-capacity" shows as "0 seats
  // available" rather than a negative count. The over-capacity state
  // is conveyed separately via the `is-over` class and the message
  // below.
  const available =
    hasCount && hasCapacity ? Math.max(0, capacity - enrolled) : null;

  // Whether the course is strictly over capacity (data-integrity
  // signal that should be visually distinct from "exactly full").
  const isOver = hasCount && hasCapacity && enrolled > capacity;
  const overBy = isOver ? enrolled - capacity : 0;

  return (
    <div className="enrollment-capacity">
      <strong>Course availability</strong>

      {hasCount && hasCapacity ? (
        <>
          <p>
            {isOver
              ? // Over-capacity: report the surplus so an admin
                // knows the underlying data has drifted.
                `Course is ${overBy} over capacity.`
              : available === 0
                ? // Exactly full: keep the "appears to be" hedge —
                  // the count can be stale by submit time.
                  "This course appears to be full."
                : `${available} seat${available === 1 ? "" : "s"} available.`}
          </p>

          <div
            className="enrollment-capacity-track"
            role="progressbar"
            aria-label="Current course capacity"
            aria-valuemin={0}
            aria-valuemax={capacity}
            // Cap at capacity so aria-valuenow stays within the
            // documented [min, max] range. Over-capacity is
            // communicated via aria-valuetext below.
            aria-valuenow={Math.min(enrolled, capacity)}
            // 🔴 ADDED: overrides the numeric announcement with the
            // accurate count when over-capacity. Without this, SRs
            // hear "30 of 30" (wrong) for a course with 35 enrolled.
            aria-valuetext={
              isOver
                ? `${enrolled} enrolled of ${capacity} seats (over capacity)`
                : `${enrolled} enrolled of ${capacity} seats`
            }
          >
            <span
              // 🔴 FIXED: added `is-over` class for over-capacity.
              // Previously only `is-full` existed — 35/30 and 30/30
              // looked identical, hiding the data-integrity issue.
              className={`enrollment-capacity-fill${
                available === 0 ? " is-full" : ""
              }${isOver ? " is-over" : ""}`}
              style={{
                // Clamped to 100 so the fill never overflows the
                // track. Safe now that `enrolled` is clamped to ≥ 0
                // (no negative widths).
                width: `${Math.min(100, (enrolled / capacity) * 100)}%`,
              }}
              // ✅ ADDED: `aria-hidden` — SRs read the progressbar
              // role on the parent, not the visual fill.
              aria-hidden="true"
            />
          </div>

          <small>
            {/* toLocaleString() formats 10000 as "10,000" — matches
                the formatting used in DashboardPage metric cards. */}
            {enrolled.toLocaleString()} enrolled out of{" "}
            {capacity.toLocaleString()}
          </small>
        </>
      ) : (
        <p>
          Capacity information is unavailable. The server will verify
          availability when you submit the enrollment.
        </p>
      )}
    </div>
  );
}
