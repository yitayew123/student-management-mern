import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Spinner from "../ui/Spinner";

/**
 * Restrict nested routes to signed-in users and, optionally, specific roles
 * or permissions. Renders matching child routes through <Outlet />.
 */
export default function ProtectedRoute({ allowedRoles, requiredPermissions }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for session restoration before deciding whether access is allowed.
  if (loading) {
    return (
      <div className="auth-loading">
        <Spinner label="Checking your session..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // A role restriction allows only users whose role is listed.
  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // A permission restriction allows access when the user has any listed permission.
  if (requiredPermissions?.length) {
    const userPerms = user.permissions ?? [];
    const hasAny = requiredPermissions.some((p) => userPerms.includes(p));
    if (!hasAny) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
}
