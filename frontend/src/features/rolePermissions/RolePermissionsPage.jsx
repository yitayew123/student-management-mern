import { useCallback, useEffect, useState } from "react";
import {
  getRolePermissions,
  updateRolePermissions,
} from "./api/rolePermissionsApi";
import { getErrorMessage } from "../../api/apiErrors";
import "./rolePermissions.css";

const ROLE_LABELS = {
  admin: "Administrator",
  instructor: "Instructor",
  student: "Student",
};

export default function RolePermissionsPage() {
  const [catalog, setCatalog] = useState(null);
  const [policy, setPolicy] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingRole, setSavingRole] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getRolePermissions();
      setCatalog(result.catalog);
      setPolicy(result.policy);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load role permissions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function togglePermission(role, permission) {
    setPolicy((prev) => {
      const current = prev[role] ?? [];
      const next = current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission];
      return { ...prev, [role]: next };
    });
    setNotice("");
  }

  async function saveRole(role) {
    setSavingRole(role);
    setError("");
    setNotice("");
    try {
      await updateRolePermissions(role, policy[role]);
      setNotice(`Permissions saved for ${ROLE_LABELS[role]}.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save permissions."));
    } finally {
      setSavingRole(null);
    }
  }

  if (loading) {
    return (
      <section className="role-perms-page">
        <p role="status">Loading role permissions...</p>
      </section>
    );
  }

  if (!catalog) {
    return (
      <section className="role-perms-page">
        <div className="role-perms-error" role="alert">
          {error || "Could not load permissions."}
        </div>
      </section>
    );
  }

  return (
    <section className="role-perms-page" aria-labelledby="role-perms-title">
      <header className="role-perms-header">
        <div>
          <p className="role-perms-eyebrow">ADMINISTRATION</p>
          <h1 id="role-perms-title">Role Permissions</h1>
          <p className="role-perms-subtitle">
            Control what each role can see and do. Changes apply on the
            user&apos;s next login or session refresh.
          </p>
        </div>
      </header>

      {notice && (
        <div
          className="role-perms-notice role-perms-notice--success"
          role="status"
        >
          {notice}
        </div>
      )}
      {error && (
        <div
          className="role-perms-notice role-perms-notice--error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="role-perms-table-wrap">
        <table className="role-perms-table">
          <thead>
            <tr>
              <th scope="col">Module / Permission</th>
              {catalog.roles.map((role) => (
                <th key={role} scope="col">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(catalog.groups).map(([group, perms]) => (
              <tr key={group} className="role-perms-group-row">
                <td colSpan={catalog.roles.length + 1}>
                  <strong>{group}</strong>
                </td>
              </tr>
            )) &&
              Object.entries(catalog.groups).flatMap(([group, perms]) =>
                perms.map((permission) => (
                  <tr key={permission}>
                    <td>
                      <code className="role-perms-key">{permission}</code>
                      <div className="role-perms-desc">
                        {catalog.descriptions[permission]}
                      </div>
                    </td>
                    {catalog.roles.map((role) => (
                      <td key={role}>
                        <label className="role-perms-check">
                          <input
                            type="checkbox"
                            checked={(policy[role] ?? []).includes(permission)}
                            onChange={() => togglePermission(role, permission)}
                            aria-label={`${ROLE_LABELS[role]}: ${catalog.descriptions[permission]}`}
                          />
                        </label>
                      </td>
                    ))}
                  </tr>
                )),
              )}
          </tbody>
        </table>
      </div>

      <div className="role-perms-actions">
        {catalog.roles.map((role) => (
          <button
            key={role}
            type="button"
            className="role-perms-btn role-perms-btn--primary"
            onClick={() => saveRole(role)}
            disabled={savingRole === role}
          >
            {savingRole === role ? "Saving..." : `Save ${ROLE_LABELS[role]}`}
          </button>
        ))}
      </div>
    </section>
  );
}
