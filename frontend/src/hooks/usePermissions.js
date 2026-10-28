import { useAuth } from "../contexts/AuthContext";

/**
 * usePermissions — client-side permission check helper.
 *
 * Usage:
 *   const { has, hasAny, hasAll } = usePermissions();
 *   if (has("students.create")) { ... }
 *
 * ⚠️ These checks are UI-only. The backend independently enforces
 * the same permissions — never rely on `has()` for security.
 * Hiding a button the user can't use is UX polish, not security.
 */
export function usePermissions() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  return {
    permissions,
    has: (p) => permissions.includes(p),
    hasAny: (...ps) => ps.some((p) => permissions.includes(p)),
    hasAll: (...ps) => ps.every((p) => permissions.includes(p)),
  };
}
