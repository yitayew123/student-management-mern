import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  createCourse,
  getCourses,
  updateCourse,
  updateCourseStatus,
} from "../api/coursesApi";
import CourseForm from "../components/CourseForm";
import CourseCapacity from "../components/CourseCapacity";
import CourseStatusBadge from "../components/CourseStatusBadge";
import { usePermissions } from "../../../hooks/usePermissions";
import "../courses.css";

const PAGE_SIZE = 10;

function getId(item) {
  return item?._id ?? item?.id;
}

function getErrorMessage(error) {
  return error?.message ?? "Something went wrong. Please try again.";
}

function getNextStatus(course) {
  const current = String(course?.status ?? "").toLowerCase();
  if (current === "archived") return null;
  if (current === "active") return "inactive";
  if (current === "inactive") return "active";
  return null;
}

export default function CoursesPage() {
  const { has } = usePermissions();
  const canCreate = has("courses.create");
  const canUpdate = has("courses.update");

  const [courses, setCourses] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("title");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [saving, setSaving] = useState(false);

  const [pendingCourse, setPendingCourse] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const formModalRef = useRef(null);
  const confirmModalRef = useRef(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const result = await getCourses({
        page,
        limit: PAGE_SIZE,
        search,
        status: status || undefined,
        sortBy,
        order: sortOrder, // backend expects `order`, not `sortOrder`
      });
      setCourses(result.items);
      setPagination(result.pagination);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, sortBy, sortOrder]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setNotice("");
  }, [page, search, status]);

  useEffect(() => {
    const anyModalOpen = dialogOpen || Boolean(pendingCourse);
    if (!anyModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleEscape(e) {
      if (e.key !== "Escape") return;
      if (dialogOpen && !saving) setDialogOpen(false);
      if (pendingCourse && !statusSaving) setPendingCourse(null);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dialogOpen, pendingCourse, saving, statusSaving]);

  useEffect(() => {
    if (dialogOpen) requestAnimationFrame(() => formModalRef.current?.focus());
    if (pendingCourse)
      requestAnimationFrame(() => confirmModalRef.current?.focus());
  }, [dialogOpen, pendingCourse]);

  const totalItems = pagination?.total ?? courses.length;
  const totalPages = pagination?.totalPages ?? 1;

  function openCreateDialog() {
    setEditingCourse(null);
    setDialogOpen(true);
    setNotice("");
  }

  function openEditDialog(course) {
    setEditingCourse(course);
    setDialogOpen(true);
    setNotice("");
  }

  async function handleSave(values) {
    setSaving(true);
    try {
      if (editingCourse) {
        await updateCourse(getId(editingCourse), values);
        setNotice("Course updated successfully.");
      } else {
        await createCourse(values);
        setNotice("Course created successfully.");
      }
      setDialogOpen(false);
      setEditingCourse(null);
      setPage(1);
      setSearch(searchInput.trim());
      await loadCourses();
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!pendingCourse) return;
    const nextStatus = getNextStatus(pendingCourse);
    if (!nextStatus) {
      setPageError(
        "This course's status cannot be changed via the quick toggle. Use the Edit form instead.",
      );
      setPendingCourse(null);
      return;
    }
    setStatusSaving(true);
    setPageError("");
    try {
      await updateCourseStatus(getId(pendingCourse), nextStatus);
      setNotice(`${pendingCourse.courseCode} is now ${nextStatus}.`);
      setPendingCourse(null);
      await loadCourses();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setStatusSaving(false);
    }
  }

  function toggleSort(field) {
    if (sortBy === field) {
      setSortOrder((c) => (c === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function sortLabel(field, label) {
    const arrow = sortBy !== field ? "" : sortOrder === "asc" ? " ↑" : " ↓";
    return (
      <button
        type="button"
        className="course-sort-button"
        onClick={() => toggleSort(field)}
      >
        {label}
        {arrow}
      </button>
    );
  }

  const tableRows = useMemo(
    () =>
      courses.map((course) => ({
        course,
        next: getNextStatus(course),
      })),
    [courses],
  );

  return (
    <section className="courses-page" aria-labelledby="courses-title">
      <div className="courses-heading">
        <div>
          <p className="courses-eyebrow">ACADEMIC CATALOG</p>
          <h2 id="courses-title">Courses</h2>
          <p className="courses-subtitle">
            Manage course details, enrollment limits, and availability.
          </p>
        </div>

        {/* ✅ Hidden if user lacks courses.create */}
        {canCreate && (
          <button
            type="button"
            className="course-button course-button-primary"
            onClick={openCreateDialog}
          >
            <Plus size={16} aria-hidden="true" /> Add course
          </button>
        )}
      </div>

      {notice && (
        <div className="courses-notice" role="status">
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
        <div className="courses-error" role="alert">
          <span>{pageError}</span>
          <button
            type="button"
            className="course-button course-button-secondary"
            onClick={loadCourses}
          >
            Retry
          </button>
        </div>
      )}

      <div className="courses-toolbar">
        <label className="course-search">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search courses</span>
          <input
            type="search"
            value={searchInput}
            placeholder="Search course code, title, or department..."
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>

        <label className="course-status-filter">
          <span className="sr-only">Filter courses by status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      <div className="courses-table-card">
        <div className="courses-table-topline">
          <strong>Course directory</strong>
          <span>
            {totalItems} course{totalItems === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="courses-state" role="status">
            <span className="course-loader" aria-hidden="true" />
            <p>Loading courses...</p>
          </div>
        ) : !pageError && courses.length === 0 ? (
          <div className="courses-state">
            <div className="courses-empty-icon" aria-hidden="true">
              ▤
            </div>
            <h3>No courses found</h3>
            <p>
              {search || status
                ? "Try changing your search or status filter."
                : "Create your first course to get started."}
            </p>
            {!search && !status && canCreate && (
              <button
                type="button"
                className="course-button course-button-primary"
                onClick={openCreateDialog}
              >
                Add course
              </button>
            )}
          </div>
        ) : !pageError ? (
          <>
            <div className="courses-table-scroll">
              <table className="courses-table">
                <thead>
                  <tr>
                    <th scope="col">
                      {sortLabel("courseCode", "Course code")}
                    </th>
                    <th scope="col">{sortLabel("title", "Course")}</th>
                    <th scope="col">Department</th>
                    <th scope="col">Credits</th>
                    <th scope="col">
                      {sortLabel("capacity", "Enrollment / Capacity")}
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({ course, next }) => (
                    <tr key={getId(course)}>
                      <td className="course-code">{course.courseCode}</td>
                      <td>
                        <div className="course-identity">
                          <strong>{course.title}</strong>
                          {course.description && (
                            <small>{course.description}</small>
                          )}
                        </div>
                      </td>
                      <td>{course.department || "—"}</td>
                      <td>{course.credits ?? "—"}</td>
                      <td className="course-capacity-cell">
                        <CourseCapacity course={course} compact />
                      </td>
                      <td>
                        <CourseStatusBadge status={course.status} />
                      </td>
                      <td>
                        <div className="course-row-actions">
                          {/* ✅ Hidden if user lacks courses.update */}
                          {canUpdate && (
                            <button
                              type="button"
                              className="course-action"
                              onClick={() => openEditDialog(course)}
                              aria-label={`Edit ${course.courseCode}`}
                            >
                              Edit
                            </button>
                          )}
                          {/* ✅ Hidden if no valid transition or lacking permission */}
                          {canUpdate && next && (
                            <button
                              type="button"
                              className="course-action"
                              onClick={() => setPendingCourse(course)}
                              aria-label={`${next === "active" ? "Activate" : "Deactivate"} ${course.courseCode}`}
                            >
                              {next === "active" ? "Activate" : "Deactivate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="courses-pagination">
              <span>
                Page {page} of {Math.max(1, totalPages)}
              </span>
              <div>
                <button
                  type="button"
                  className="course-button course-button-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((c) => c - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="course-button course-button-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((c) => c + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {dialogOpen && (
        <div
          className="course-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setDialogOpen(false);
          }}
        >
          <section
            ref={formModalRef}
            tabIndex={-1}
            className="course-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-modal-title"
          >
            <div className="course-modal-heading">
              <div>
                <p className="courses-eyebrow">COURSE INFORMATION</p>
                <h2 id="course-modal-title">
                  {editingCourse ? "Edit course" : "Add course"}
                </h2>
                <p>Complete the course information and capacity.</p>
              </div>
              <button
                type="button"
                className="course-modal-close"
                aria-label="Close form"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
              >
                ×
              </button>
            </div>

            {editingCourse && (
              <div className="course-modal-capacity">
                <strong>Current enrollment</strong>
                <CourseCapacity course={editingCourse} />
              </div>
            )}

            <CourseForm
              key={getId(editingCourse) ?? "new-course"}
              initialValues={editingCourse ?? undefined}
              onSubmit={handleSave}
              onCancel={() => setDialogOpen(false)}
              submitting={saving}
            />
          </section>
        </div>
      )}

      {pendingCourse && (
        <div
          className="course-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !statusSaving)
              setPendingCourse(null);
          }}
        >
          <section
            ref={confirmModalRef}
            tabIndex={-1}
            className="course-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="course-status-confirm-title"
            aria-describedby="course-status-confirm-description"
          >
            <h2 id="course-status-confirm-title">Change course status?</h2>
            <p id="course-status-confirm-description">
              {getNextStatus(pendingCourse)
                ? `${pendingCourse.courseCode} — ${pendingCourse.title} will be marked ${getNextStatus(pendingCourse)}.`
                : `${pendingCourse.courseCode} — ${pendingCourse.title} cannot be toggled directly.`}{" "}
              This may affect whether the course is available for new
              enrollments.
            </p>
            <div className="course-form-actions">
              <button
                type="button"
                className="course-button course-button-secondary"
                disabled={statusSaving}
                onClick={() => setPendingCourse(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="course-button course-button-primary"
                disabled={statusSaving}
                onClick={handleConfirmStatusChange}
              >
                {statusSaving ? "Updating..." : "Confirm change"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
