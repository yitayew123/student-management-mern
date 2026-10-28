import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  cancelEnrollment,
  createEnrollment,
  getEnrollments,
} from "../api/enrollmentsApi";
import EnrollmentForm from "../components/EnrollmentForm";
import EnrollmentTable from "../components/EnrollmentTable";
import { usePermissions } from "../../../hooks/usePermissions";
import "../enrollments.css";

const STATUS_OPTIONS = [
  { value: "enrolled", label: "Enrolled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "dropped", label: "Dropped" },
  { value: "withdrawn", label: "Withdrawn" },
];

function getId(item) {
  return item?._id ?? item?.id;
}

function getMessage(error) {
  const code = error?.code;
  const message = error?.message ?? "An unexpected error occurred.";

  if (error?.isNetworkError) {
    return "Cannot reach the server. Check your connection and try again.";
  }
  if (code === "DUPLICATE_ACTIVE_ENROLLMENT") {
    return "This student already has an active enrollment in this course for the selected term.";
  }
  if (code === "COURSE_CAPACITY_REACHED") {
    return "The course has no available seats. Choose another course or increase its capacity.";
  }
  if (code === "COURSE_NOT_ACTIVE") {
    return "This course is inactive or archived and cannot accept new enrollments.";
  }
  if (code === "STUDENT_NOT_ACTIVE") {
    return "This student is inactive and cannot be enrolled.";
  }
  if (code === "ENROLLMENT_ALREADY_CANCELLED") {
    return "This enrollment has already been cancelled.";
  }
  if (code === "ENROLLMENT_NOT_ACTIVE") {
    return "Only an active enrollment can be cancelled.";
  }
  if (code === "VALIDATION_ERROR") {
    return "The request was rejected by the server. Check the form values and try again.";
  }
  return message;
}

export default function EnrollmentsPage() {
  const { has } = usePermissions();
  const canCreate = has("enrollments.create");
  const canCancel = has("enrollments.cancel");

  const [enrollments, setEnrollments] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [studentFilter, setStudentFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [debouncedStudent, setDebouncedStudent] = useState("");
  const [debouncedCourse, setDebouncedCourse] = useState("");

  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");

  const formModalRef = useRef(null);
  const cancelModalRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedStudent(studentFilter.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [studentFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCourse(courseFilter.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [courseFilter]);

  const loadEnrollments = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      // Note: backend `listEnrollmentsQuerySchema` does NOT support a
      // `search` field. The list is filterable by student/course ID and
      // status only.
      const result = await getEnrollments({
        page,
        limit,
        student: debouncedStudent || undefined,
        course: debouncedCourse || undefined,
        status: statusFilter || undefined,
      });
      setEnrollments(result.items);
      setPagination(result.pagination);
    } catch (error) {
      setPageError(getMessage(error));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedStudent, debouncedCourse, statusFilter]);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  useEffect(() => {
    setNotice("");
  }, [page, statusFilter]);

  useEffect(() => {
    const anyModalOpen = formOpen || Boolean(cancelTarget);
    if (!anyModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleEscape(e) {
      if (e.key !== "Escape") return;
      if (formOpen && !saving) setFormOpen(false);
      if (cancelTarget && !cancellingId) setCancelTarget(null);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [formOpen, cancelTarget, saving, cancellingId]);

  useEffect(() => {
    if (formOpen) requestAnimationFrame(() => formModalRef.current?.focus());
    if (cancelTarget)
      requestAnimationFrame(() => cancelModalRef.current?.focus());
  }, [formOpen, cancelTarget]);

  const totalItems = pagination?.total ?? enrollments.length;
  const totalPages = pagination?.totalPages ?? 1;

  async function handleCreate(payload) {
    setSaving(true);
    try {
      await createEnrollment(payload);
      setFormOpen(false);
      setNotice("Enrollment created successfully.");
      setPage(1);
      await loadEnrollments();
    } catch (error) {
      // Let the form handle the error mapping — it already displays
      // field-level details if present.
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function requestCancellation(enrollment) {
    setCancelTarget(enrollment);
    setCancelReason("");
    setCancelError("");
  }

  async function confirmCancellation() {
    if (!cancelTarget) return;
    const id = getId(cancelTarget);
    if (!id) {
      setCancelError("Cannot cancel this enrollment: its ID is missing.");
      return;
    }
    setCancellingId(id);
    setCancelError("");
    setPageError("");
    try {
      await cancelEnrollment(id, cancelReason.trim() || undefined);
      setCancelTarget(null);
      setNotice("Enrollment cancelled. Its history remains available.");
      await loadEnrollments();
    } catch (error) {
      setCancelError(getMessage(error));
    } finally {
      setCancellingId(null);
    }
  }

  function resetFilters() {
    setPage(1);
    setStudentFilter("");
    setCourseFilter("");
    setStatusFilter("");
  }

  const cancelTargetName = useMemo(() => {
    if (!cancelTarget) return "";
    const s = cancelTarget.student;
    if (!s) return "the selected student";
    if (typeof s === "string") return s;
    const parts = [s.firstName, s.lastName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return s.fullName ?? s.name ?? s.email ?? "the selected student";
  }, [cancelTarget]);

  const cancelTargetCourse = useMemo(() => {
    if (!cancelTarget) return "";
    const c = cancelTarget.course;
    if (!c) return "the selected course";
    if (typeof c === "string") return c;
    return c.courseCode ?? c.title ?? "the selected course";
  }, [cancelTarget]);

  return (
    <section className="enrollments-page" aria-labelledby="enrollments-title">
      <div className="enrollments-heading">
        <div>
          <p className="enrollments-eyebrow">ACADEMIC OPERATIONS</p>
          <h2 id="enrollments-title">Enrollments</h2>
          <p>
            Manage student course registrations and preserve enrollment history.
          </p>
        </div>

        {/* ✅ Hidden if user lacks enrollments.create */}
        {canCreate && (
          <button
            type="button"
            className="enrollment-button enrollment-button-primary"
            onClick={() => {
              setFormOpen(true);
              setPageError("");
              setNotice("");
            }}
          >
            <Plus size={16} aria-hidden="true" /> New enrollment
          </button>
        )}
      </div>

      {notice && (
        <div
          className="enrollment-alert enrollment-alert-success"
          role="status"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}

      {pageError && (
        <div className="enrollment-alert enrollment-alert-error" role="alert">
          <span>{pageError}</span>
          <button
            type="button"
            className="enrollment-button enrollment-button-secondary"
            onClick={loadEnrollments}
          >
            Retry
          </button>
        </div>
      )}

      <div className="enrollment-filters">
        <label>
          <span className="sr-only">Filter by student ID</span>
          <input
            type="text"
            placeholder="Student ObjectId (24 hex chars)"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
          />
        </label>

        <label>
          <span className="sr-only">Filter by course ID</span>
          <input
            type="text"
            placeholder="Course ObjectId (24 hex chars)"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          />
        </label>

        <label>
          <span className="sr-only">Filter by enrollment status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="enrollment-button enrollment-button-secondary"
          onClick={resetFilters}
        >
          Reset
        </button>
      </div>

      <div className="enrollment-table-card">
        <div className="enrollment-table-header">
          <strong>Enrollment history</strong>
          <span>
            {totalItems} record{totalItems === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="enrollment-state" role="status">
            <span className="enrollment-loader" aria-hidden="true" />
            <p>Loading enrollments...</p>
          </div>
        ) : !pageError ? (
          <EnrollmentTable
            enrollments={enrollments}
            onCancelEnrollment={requestCancellation}
            cancellingId={cancellingId}
            // ✅ Passed down — the table hides the cancel button if false.
            canManage={canCancel}
            label="Enrollment history"
          />
        ) : null}

        {!loading && !pageError && (
          <div className="enrollment-pagination">
            <span>
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <div>
              <button
                type="button"
                className="enrollment-button enrollment-button-secondary"
                disabled={page <= 1}
                onClick={() => setPage((c) => c - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="enrollment-button enrollment-button-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((c) => c + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {formOpen && (
        <div
          className="enrollment-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setFormOpen(false);
          }}
        >
          <section
            ref={formModalRef}
            tabIndex={-1}
            className="enrollment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enrollment-form-title"
          >
            <div className="enrollment-modal-heading">
              <div>
                <p className="enrollments-eyebrow">NEW REGISTRATION</p>
                <h2 id="enrollment-form-title">Create enrollment</h2>
                <p>Select an eligible student and an available course.</p>
              </div>
              <button
                type="button"
                className="enrollment-modal-close"
                aria-label="Close enrollment form"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                ×
              </button>
            </div>
            <EnrollmentForm
              onSubmit={handleCreate}
              onCancel={() => setFormOpen(false)}
              submitting={saving}
            />
          </section>
        </div>
      )}

      {cancelTarget && (
        <div
          className="enrollment-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !cancellingId)
              setCancelTarget(null);
          }}
        >
          <section
            ref={cancelModalRef}
            tabIndex={-1}
            className="enrollment-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-enrollment-title"
            aria-describedby="cancel-enrollment-description"
          >
            <h2 id="cancel-enrollment-title">Cancel enrollment?</h2>
            <p id="cancel-enrollment-description">
              This will cancel the enrollment for{" "}
              <strong>{cancelTargetName}</strong> in{" "}
              <strong>{cancelTargetCourse}</strong>. The record will remain in
              the enrollment history for audit purposes.
            </p>

            <label className="enrollment-field" htmlFor="cancel-reason">
              Cancellation reason (optional)
              <textarea
                id="cancel-reason"
                rows={3}
                maxLength={500}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                disabled={Boolean(cancellingId)}
                placeholder="Enter a reason if needed..."
              />
            </label>

            {cancelError && (
              <div
                className="enrollment-alert enrollment-alert-error"
                role="alert"
              >
                {cancelError}
              </div>
            )}

            <div className="enrollment-form-actions">
              <button
                type="button"
                className="enrollment-button enrollment-button-secondary"
                disabled={Boolean(cancellingId)}
                onClick={() => setCancelTarget(null)}
              >
                Keep enrollment
              </button>
              <button
                type="button"
                className="enrollment-button enrollment-button-danger"
                disabled={Boolean(cancellingId)}
                aria-busy={Boolean(cancellingId)}
                onClick={confirmCancellation}
              >
                {cancellingId ? "Cancelling..." : "Confirm cancellation"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
