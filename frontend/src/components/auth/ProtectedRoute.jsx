import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Spinner from "../ui/Spinner";

export default function ProtectedRoute({ allowedRoles, requiredPermissions }) {
  const { user, loading } = useAuth();
  const location = useLocation();

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

  // Role check (legacy — still supported)
  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // NEW: permission check (any of the listed permissions grants access)
  if (requiredPermissions?.length) {
    const userPerms = user.permissions ?? [];
    const hasAny = requiredPermissions.some((p) => userPerms.includes(p));
    if (!hasAny) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
}
