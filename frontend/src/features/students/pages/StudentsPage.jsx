import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  createStudent,
  getStudents,
  updateStudent,
  updateStudentStatus,
} from "../api/studentsApi";
import StudentForm from "../components/StudentForm";
import StudentStatusBadge from "../components/StudentStatusBadge";
import { usePermissions } from "../../../hooks/usePermissions";
import "../students.css";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "graduated", label: "Graduated" },
  { value: "suspended", label: "Suspended" },
];

function getId(item) {
  return item?._id ?? item?.id;
}

function fullName(student) {
  const parts = [student?.firstName, student?.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unnamed student";
}

function initials(student) {
  return (
    [student?.firstName, student?.lastName]
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "S"
  );
}

function getErrorMessage(error) {
  return error?.message ?? "Something went wrong. Please try again.";
}

export default function StudentsPage() {
  const { has } = usePermissions();
  const canCreate = has("students.create");
  const canUpdate = has("students.update");
  const canDelete = has("students.delete");

  const [students, setStudents] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("firstName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [saving, setSaving] = useState(false);

  const [pendingStatusStudent, setPendingStatusStudent] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const formModalRef = useRef(null);
  const confirmModalRef = useRef(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const result = await getStudents({
        page,
        limit: PAGE_SIZE,
        search,
        status: status || undefined,
        sortBy,
        // 🔴 Correct key is `order` — backend query schema is `.strict()`.
        order: sortOrder,
      });
      setStudents(result.items);
      setPagination(result.pagination);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, sortBy, sortOrder]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Modal a11y — Escape + body scroll lock.
  useEffect(() => {
    const anyModalOpen = dialogOpen || Boolean(pendingStatusStudent);
    if (!anyModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleEscape(e) {
      if (e.key !== "Escape") return;
      if (dialogOpen && !saving) setDialogOpen(false);
      if (pendingStatusStudent && !statusSaving) setPendingStatusStudent(null);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dialogOpen, pendingStatusStudent, saving, statusSaving]);

  useEffect(() => {
    if (dialogOpen) requestAnimationFrame(() => formModalRef.current?.focus());
    if (pendingStatusStudent)
      requestAnimationFrame(() => confirmModalRef.current?.focus());
  }, [dialogOpen, pendingStatusStudent]);

  const totalItems = pagination?.total ?? students.length;
  const totalPages = pagination?.totalPages ?? 1;

  function openCreateDialog() {
    setEditingStudent(null);
    setDialogOpen(true);
    setNotice("");
  }

  function openEditDialog(student) {
    setEditingStudent(student);
    setDialogOpen(true);
    setNotice("");
  }

  async function handleSave(values) {
    setSaving(true);
    try {
      if (editingStudent) {
        await updateStudent(getId(editingStudent), values);
        setNotice("Student details updated successfully.");
      } else {
        await createStudent(values);
        setNotice("Student created successfully.");
        setPage(1);
      }
      setDialogOpen(false);
      setEditingStudent(null);
      await loadStudents();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusConfirm() {
    if (!pendingStatusStudent) return;
    const nextStatus =
      String(pendingStatusStudent.status).toLowerCase() === "active"
        ? "inactive"
        : "active";
    setStatusSaving(true);
    setPageError("");
    try {
      await updateStudentStatus(getId(pendingStatusStudent), nextStatus);
      setNotice(`Student status changed to ${nextStatus}.`);
      setPendingStatusStudent(null);
      await loadStudents();
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

  const tableRows = useMemo(
    () =>
      students.map((student) => {
        const currentStatus = String(student.status ?? "").toLowerCase();
        const showToggle =
          (canUpdate || canDelete) &&
          (currentStatus === "active" || currentStatus === "inactive");
        return { student, currentStatus, showToggle };
      }),
    [students, canUpdate, canDelete],
  );

  return (
    <section className="students-page" aria-labelledby="students-title">
      <div className="students-heading">
        <div>
          <p className="students-eyebrow">ACADEMIC RECORDS</p>
          <h2 id="students-title">Students</h2>
          <p className="students-subtitle">
            Manage student profiles, programs, and account status.
          </p>
        </div>

        {/* ✅ Hidden if user lacks students.create */}
        {canCreate && (
          <button
            type="button"
            className="student-button student-button-primary"
            onClick={openCreateDialog}
          >
            <Plus size={16} aria-hidden="true" /> Add student
          </button>
        )}
      </div>

      {notice && (
        <div className="students-notice" role="status">
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
        <div className="students-error" role="alert">
          <span>{pageError}</span>
          <button
            type="button"
            className="student-button student-button-secondary"
            onClick={loadStudents}
          >
            Retry
          </button>
        </div>
      )}

      <div className="students-toolbar">
        <label className="student-search">
          <span className="student-search-icon" aria-hidden="true">
            ⌕
          </span>
          <span className="sr-only">Search students</span>
          <input
            type="search"
            value={searchInput}
            placeholder="Search name, ID, or email..."
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>

        <label className="student-status-filter">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
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
      </div>

      <div className="students-table-card">
        <div className="students-table-topline">
          <strong>Student directory</strong>
          <span>
            {totalItems} record{totalItems === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="students-state" role="status">
            <span className="student-loader" aria-hidden="true" />
            <p>Loading students...</p>
          </div>
        ) : !pageError && students.length === 0 ? (
          <div className="students-state">
            <div className="students-empty-icon" aria-hidden="true">
              ♙
            </div>
            <h3>No students found</h3>
            <p>
              {search || status
                ? "Try changing your search or filter."
                : "Add your first student to get started."}
            </p>
            {!search && !status && canCreate && (
              <button
                type="button"
                className="student-button student-button-primary"
                onClick={openCreateDialog}
              >
                Add student
              </button>
            )}
          </div>
        ) : !pageError ? (
          <>
            <div className="students-table-scroll">
              <table className="students-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() => toggleSort("studentId")}
                      >
                        Student ID
                        {sortBy === "studentId" &&
                          (sortOrder === "asc" ? " ↑" : " ↓")}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() => toggleSort("firstName")}
                      >
                        Student
                        {sortBy === "firstName" &&
                          (sortOrder === "asc" ? " ↑" : " ↓")}
                      </button>
                    </th>
                    <th scope="col">Program</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({ student, currentStatus, showToggle }) => (
                    <tr key={getId(student)}>
                      <td className="student-number">{student.studentId}</td>
                      <td>
                        <div className="student-identity">
                          <span className="student-avatar" aria-hidden="true">
                            {initials(student)}
                          </span>
                          <span className="student-identity-copy">
                            <strong>{fullName(student)}</strong>
                            <small>{student.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>{student.program || "—"}</td>
                      <td>{student.phone || "—"}</td>
                      <td>
                        <StudentStatusBadge status={student.status} />
                      </td>
                      <td>
                        <div className="student-row-actions">
                          {/* ✅ Hidden if user lacks students.update */}
                          {canUpdate && (
                            <button
                              type="button"
                              className="student-action"
                              onClick={() => openEditDialog(student)}
                              aria-label={`Edit ${fullName(student)}`}
                            >
                              Edit
                            </button>
                          )}
                          {/* ✅ Hidden if user lacks students.delete */}
                          {canDelete && showToggle && (
                            <button
                              type="button"
                              className="student-action"
                              onClick={() => setPendingStatusStudent(student)}
                              aria-label={`${currentStatus === "active" ? "Deactivate" : "Activate"} ${fullName(student)}`}
                            >
                              {currentStatus === "active"
                                ? "Deactivate"
                                : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="students-pagination">
              <span>
                Page {page} of {Math.max(1, totalPages)}
              </span>
              <div>
                <button
                  type="button"
                  className="student-button student-button-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((c) => c - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="student-button student-button-secondary"
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
          className="student-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setDialogOpen(false);
          }}
        >
          <section
            ref={formModalRef}
            tabIndex={-1}
            className="student-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-modal-title"
          >
            <div className="student-modal-heading">
              <div>
                <p className="students-eyebrow">STUDENT INFORMATION</p>
                <h2 id="student-modal-title">
                  {editingStudent ? "Edit student" : "Add student"}
                </h2>
                <p>Complete the required fields below.</p>
              </div>
              <button
                type="button"
                className="student-modal-close"
                aria-label="Close form"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
              >
                ×
              </button>
            </div>
            <StudentForm
              key={getId(editingStudent) ?? "new-student"}
              initialValues={editingStudent ?? undefined}
              onSubmit={handleSave}
              onCancel={() => setDialogOpen(false)}
              submitting={saving}
            />
          </section>
        </div>
      )}

      {pendingStatusStudent && (
        <div
          className="student-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !statusSaving)
              setPendingStatusStudent(null);
          }}
        >
          <section
            ref={confirmModalRef}
            tabIndex={-1}
            className="student-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="student-status-confirm-title"
            aria-describedby="student-status-confirm-description"
          >
            <h2 id="student-status-confirm-title">Change student status?</h2>
            <p id="student-status-confirm-description">
              {String(pendingStatusStudent.status).toLowerCase() === "active"
                ? "This student will be marked inactive."
                : "This student will be marked active again."}
            </p>
            <div className="student-form-actions">
              <button
                type="button"
                className="student-button student-button-secondary"
                disabled={statusSaving}
                onClick={() => setPendingStatusStudent(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="student-button student-button-primary"
                disabled={statusSaving}
                onClick={handleStatusConfirm}
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
