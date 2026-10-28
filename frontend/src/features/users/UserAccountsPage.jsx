import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { getUsers, createUser, changeUserStatus } from "./api/usersApi";
import { getErrorMessage } from "../../api/apiErrors";
import CreateUserModal from "./CreateUserModal";
import "./users.css";

const ROLE_LABELS = {
  admin: "Administrator",
  instructor: "Instructor",
  student: "Student",
};

export default function UserAccountsPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState("student");
  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getUsers({
        page,
        limit: 20,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setUsers(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load users."));
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Clear notice on filter change
  useEffect(() => {
    setNotice("");
  }, [page, roleFilter, statusFilter, search]);

  function openCreate(role) {
    setModalRole(role);
    setModalOpen(true);
    setError("");
    setNotice("");
  }

  async function handleCreate(payload) {
    setSaving(true);
    try {
      await createUser(payload);
      setModalOpen(false);
      setNotice(
        `${ROLE_LABELS[payload.role]} account created for ${payload.email}.`,
      );
      setPage(1);
      await loadUsers();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user) {
    setTogglingId(user._id);
    setError("");
    try {
      const next = !user.isActive;
      await changeUserStatus(user._id, next);
      setNotice(
        `${user.fullName}'s account is now ${next ? "active" : "inactive"}.`,
      );
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update account status."));
    } finally {
      setTogglingId(null);
    }
  }

  const totalItems = pagination?.total ?? users.length;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <section className="users-page" aria-labelledby="users-title">
      <header className="users-header">
        <div>
          <p className="users-eyebrow">ADMINISTRATION</p>
          <h1 id="users-title">User Accounts</h1>
          <p className="users-subtitle">
            Create and manage login accounts for students and instructors.
            Academic records are managed separately under Students and Courses.
          </p>
        </div>

        <div className="users-header-actions">
          <button
            type="button"
            className="user-button user-button-primary"
            onClick={() => openCreate("student")}
          >
            <UserPlus size={16} aria-hidden="true" />
            New student account
          </button>
          <button
            type="button"
            className="user-button user-button-secondary"
            onClick={() => openCreate("instructor")}
          >
            <UserPlus size={16} aria-hidden="true" />
            New instructor account
          </button>
        </div>
      </header>

      {notice && (
        <div className="user-alert user-alert-success" role="status">
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

      {error && (
        <div className="user-alert user-alert-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="user-button user-button-secondary"
            onClick={loadUsers}
          >
            Retry
          </button>
        </div>
      )}

      <div className="users-toolbar">
        <label className="users-filter">
          <span className="sr-only">Search by name or email</span>
          <input
            type="search"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>

        <label className="users-filter">
          <span className="sr-only">Filter by role</span>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            <option value="admin">Administrator</option>
            <option value="instructor">Instructor</option>
            <option value="student">Student</option>
          </select>
        </label>

        <label className="users-filter">
          <span className="sr-only">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      <div className="users-table-card">
        <div className="users-table-header">
          <strong>Accounts</strong>
          <span>
            {totalItems} {totalItems === 1 ? "account" : "accounts"}
          </span>
        </div>

        {loading ? (
          <div className="users-state" role="status">
            Loading accounts...
          </div>
        ) : users.length === 0 ? (
          <div className="users-state">
            <h3>No accounts found</h3>
            <p>
              {search || roleFilter || statusFilter
                ? "Try adjusting your filters."
                : "Create a student or instructor account to get started."}
            </p>
          </div>
        ) : (
          <div className="users-table-scroll">
            <table className="users-table" aria-label="User accounts">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <strong>{u.fullName}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                    <td>
                      <span
                        className={`user-status user-status--${
                          u.isActive ? "active" : "inactive"
                        }`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        type="button"
                        className="user-action"
                        onClick={() => handleToggleStatus(u)}
                        disabled={togglingId === u._id}
                      >
                        {togglingId === u._id
                          ? "..."
                          : u.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && totalPages > 1 && (
          <div className="users-pagination">
            <span>
              Page {page} of {totalPages}
            </span>
            <div>
              <button
                type="button"
                className="user-button user-button-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="user-button user-button-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateUserModal
        open={modalOpen}
        initialRole={modalRole}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={saving}
      />
    </section>
  );
}
