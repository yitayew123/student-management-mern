import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Activity } from "lucide-react";

import { getDashboardSummary } from "./dashboardApi";
import { getErrorMessage } from "../../api/apiErrors";
import MetricCard from "./MetricCard";
import Table from "../../components/ui/Table";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import "./dashboard.css";

/**
 * DashboardPage — overview of students, courses, and enrollments.
 *
 * State model:
 *   loading      — first-load (no data yet) — shows full-page spinner
 *   refreshing   — background refresh (data already visible) — shows
 *                  spinner-in-button only, keeps metrics on screen
 *   error + no data  → "blocked"    (error state with Try again)
 *   error + data     → "stale"      (warning banner, old data dimmed)
 *   no error         → "healthy"
 *
 * A11Y:
 *   - The recent enrollments table has `aria-label="Recent enrollments"` — WCAG 1.3.1.
 *   - Loading state uses `role="status"` (polite announcement).
 *   - The all-zero empty state uses `role="status"` — announced when
 *     the dashboard loads into a "0 0 0" state.
 *   - Error notices use `role="alert"` for both blocked and stale
 *     cases — the user needs to act (retry).
 *
 * ⚠️ CRITICAL — METRIC PATH:
 *   `getDashboardSummary()` returns `{ metrics: {...}, recentEnrollments: [...] }`.
 *   The three metric values live under `.metrics`, NOT at the top level.
 *   The prior version read `summary.activeStudents` → always undefined →
 *   all three cards showed "—".
 */

const EMPTY_SUMMARY = {
  activeStudents: null,
  activeCourses: null,
  activeEnrollments: null,
  recentEnrollments: [],
};

/**
 * Extract a metric from the summary, treating missing values as
 * "unknown" (renders as "—") rather than 0. A zero-loaded summary
 * is different from a not-yet-loaded one — the empty-state banner
 * below relies on this distinction.
 */
function getMetricValue(summary, key) {
  // 🔴 FIXED: was `summary?.[key]` — but the API returns the metrics
  // nested under `result.metrics`, not at the top level.
  const value = summary?.metrics?.[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // 🔴 FIXED: `hasLoaded` was in the useCallback deps, which made
  // `loadSummary` change identity whenever `hasLoaded` flipped. The
  // effect `[loadSummary]` then re-fired → double-fetch on first mount
  // (and strict-mode double-invoke made it 4 fetches).
  //
  // Fix: mirror `hasLoaded` into a ref and drop it from the deps.
  // The ref is only used to decide "should this refresh show the
  // full-page spinner or the button spinner?" — a decision that
  // doesn't affect render output, so it's a good fit for a ref.
  const hasLoadedRef = useRef(false);

  const loadSummary = useCallback(async ({ background = false } = {}) => {
    if (background && hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const result = await getDashboardSummary();

      setSummary({
        activeStudents: getMetricValue(result, "activeStudents"),
        activeCourses: getMetricValue(result, "activeCourses"),
        activeEnrollments: getMetricValue(result, "activeEnrollments"),
        recentEnrollments: Array.isArray(result.recentEnrollments)
          ? result.recentEnrollments
          : [],
      });

      setHasLoaded(true);
      hasLoadedRef.current = true;
    } catch (requestError) {
      // Keep the last successful summary visible if refresh fails —
      // the banner above the metrics tells the user it's stale.
      setError(
        getErrorMessage(
          requestError,
          "We couldn't load the dashboard. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // ← empty deps: `loadSummary` is now stable

  useEffect(() => {
    loadSummary();
  }, [loadSummary]); // runs exactly once on mount

  const metrics = [
    {
      key: "students",
      title: "Active students",
      value: summary.activeStudents,
      description: "Students currently marked active",
      type: "students",
    },
    {
      key: "courses",
      title: "Active courses",
      value: summary.activeCourses,
      description: "Courses currently available",
      type: "courses",
    },
    {
      key: "enrollments",
      title: "Active enrollments",
      value: summary.activeEnrollments,
      description: "Enrollments currently active",
      type: "enrollments",
    },
  ];

  const allMetricsZero = hasLoaded && metrics.every((m) => m.value === 0);

  // ── Recent enrollments table columns (uses shared <Table>) ──
  const columns = [
    {
      key: "student",
      header: "Student",
      render: (row) => {
        const student = row.student;
        if (!student) return "Student";
        // Handle both populated object and raw string ref shapes.
        if (typeof student === "string") return student;
        const name = [student.firstName, student.lastName]
          .filter(Boolean)
          .join(" ");
        return name || student.name || "Student";
      },
    },
    {
      key: "course",
      header: "Course",
      render: (row) => {
        const course = row.course;
        if (!course) return "Course";
        if (typeof course === "string") return course;
        return course.title || course.name || course.courseCode || "Course";
      },
    },
    {
      key: "enrolledAt",
      header: "Enrollment date",
      // 🔴 FIXED: was reading only `enrolledAt` in the inline table.
      // Backend field is `enrolledAt` but tests/backfilled records may
      // use `enrollmentDate` or fall back to `createdAt`. Keep the
      // chain consistent with the enrollment module's table.
      render: (row) =>
        formatDate(row.enrolledAt ?? row.enrollmentDate ?? row.createdAt),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={`dashboard-status dashboard-status--${String(
            row.status ?? "unknown",
          ).toLowerCase()}`}
        >
          {row.status ?? "Unknown"}
        </span>
      ),
    },
  ];

  return (
    <section className="dashboard-page">
      <header className="dashboard-page__header">
        <div>
          <p className="dashboard-page__eyebrow">OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="dashboard-page__subtitle">
            Monitor students, courses, and enrollment activity.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-refresh-button"
          onClick={() => loadSummary({ background: hasLoadedRef.current })}
          disabled={loading || refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "dashboard-spin" : ""}
            aria-hidden="true"
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {/* ── Error banner: two flavors ──────────────────────────
          - No prior data (first-load failed) → red "blocked" state
          - Prior data exists (refresh failed) → amber "stale" state,
            keeps the metrics/table visible below
      */}
      {error && (
        <div
          className={`dashboard-notice ${
            hasLoaded ? "dashboard-notice--warning" : "dashboard-notice--error"
          }`}
          role="alert"
        >
          <div>
            <strong>
              {hasLoaded ? "Refresh failed" : "Dashboard unavailable"}
            </strong>
            <p>{error}</p>
            {hasLoaded && (
              <p className="dashboard-notice__hint">
                The figures below are from the last successful response.
              </p>
            )}
          </div>

          {!hasLoaded && (
            <button
              type="button"
              onClick={() => loadSummary()}
              disabled={loading}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* ── Loading (first-load only) ─────────────────────────── */}
      {loading && !hasLoaded ? (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <span className="dashboard-loading__spinner" aria-hidden="true" />
          <span>Loading dashboard metrics...</span>
        </div>
      ) : (
        <>
          {/* ── Metric cards ───────────────────────────────────
              Pass RAW numbers (or null) to MetricCard — it handles
              its own formatting. The prior version pre-formatted
              with `Intl.NumberFormat()`, which broke for large
              numbers ("1,234" → Number("1,234") = NaN → "—").
          */}
          <div className="dashboard-metrics">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.key}
                title={metric.title}
                value={metric.value}
                description={metric.description}
                type={metric.type}
              />
            ))}
          </div>

          {/* ── All-zero empty state ──────────────────────────
              Only shows when the API successfully returned 0/0/0 —
              not during loading (which the `hasLoaded` guard prevents).
          */}
          {allMetricsZero && (
            <div className="dashboard-empty" role="status">
              <Activity size={22} aria-hidden="true" />
              <div>
                <strong>No activity yet</strong>
                <p>
                  The API reports zero active students, courses, and
                  enrollments. Metrics will update as records are added.
                </p>
              </div>
            </div>
          )}

          {/* ── Recent enrollments ────────────────────────────
              Uses the shared <Table> component — preserves
              accessibility (aria-label, scope="col"), empty-state
              message ("No enrollment activity yet"), and getRowKey
              fallback. The prior version hid the section entirely
              when empty — losing the "no records" signal.
          */}
          <section className="dashboard-recent">
            <div className="dashboard-recent__header">
              <div>
                <h2>Recent enrollments</h2>
                <p>Latest enrollment records returned by the API.</p>
              </div>
              {hasLoaded && (
                <span className="dashboard-recent__count">
                  {summary.recentEnrollments.length} record
                  {summary.recentEnrollments.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {loading && !hasLoaded ? (
              <Spinner label="Loading recent enrollments..." size="lg" />
            ) : error && !hasLoaded ? (
              <EmptyState
                title="Activity could not be loaded"
                description="Check the API connection and try refreshing the dashboard."
              />
            ) : (
              <Table
                columns={columns}
                data={summary.recentEnrollments}
                getRowKey={(row) => row._id ?? row.id}
                label="Recent enrollments"
                emptyTitle="No enrollment activity yet"
                emptyDescription="New enrollment records will appear here when students are enrolled in courses."
              />
            )}
          </section>
        </>
      )}
    </section>
  );
}
