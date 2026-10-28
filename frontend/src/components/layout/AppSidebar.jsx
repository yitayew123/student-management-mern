import { useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  UserCog,
  ShieldCheck,
  LogOut,
  X,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";

/**
 * AppSidebar — main application navigation.
 *
 * Props:
 *   open     → boolean; mobile drawer open state.
 *   onClose  → () => void; called on overlay click, X click, and after
 *              navigating (mobile UX).
 *
 * Each nav item is gated by a permission key. If `user.permissions`
 * is missing or empty, the nav list is empty — which is the symptom
 * you saw when the backend wasn't returning permissions. Verify the
 * backend fix is applied (see authService.login + getCurrentUser).
 *
 * The Logout button at the bottom is available to every authenticated
 * user regardless of permissions — nobody should be stuck in a session
 * they can't exit.
 */

// Base items visible to any authenticated user, per permission.
const BASE_NAVIGATION_ITEMS = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    perms: ["dashboard.read"],
  },
  {
    label: "Students",
    path: "/students",
    icon: Users,
    perms: ["students.read", "students.read_assigned"],
  },
  {
    label: "Courses",
    path: "/courses",
    icon: BookOpen,
    perms: ["courses.read", "courses.read_assigned"],
  },
  {
    label: "Enrollments",
    path: "/enrollments",
    icon: ClipboardList,
    perms: [
      "enrollments.read",
      "enrollments.read_assigned",
      "enrollments.read_own",
    ],
  },
];

// Admin-only items.
const ADMIN_NAVIGATION_ITEMS = [
  {
    label: "User Accounts",
    path: "/users",
    icon: UserCog,
    perms: ["users.read"],
  },
  {
    label: "Role Permissions",
    path: "/role-permissions",
    icon: ShieldCheck,
    perms: ["role_permissions.read"],
  },
];

export default function AppSidebar({ open = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const { hasAny } = usePermissions();
  const navigate = useNavigate();

  // Compose the visible nav list from permissions. Admin with all
  // permissions sees 6 items; instructor sees 4; student sees 3.
  const navigationItems = useMemo(() => {
    const base = BASE_NAVIGATION_ITEMS.filter((item) => hasAny(...item.perms));
    const admin = ADMIN_NAVIGATION_ITEMS.filter((item) =>
      hasAny(...item.perms),
    );
    return [...base, ...admin];
  }, [hasAny]);

  function handleLogout() {
    logout();
    // `replace: true` prevents the back button from returning to a
    // protected route (which would just redirect back to /login).
    navigate("/login", { replace: true });
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}

      <aside
        className={`app-sidebar${open ? " app-sidebar--open" : ""}`}
        aria-label="Main navigation"
      >
        {/* ── Brand ─────────────────────────────────────────── */}
        <div className="sidebar-brand">
          <div className="brand-mark">
            <GraduationCap size={25} aria-hidden="true" />
          </div>

          <div className="brand-copy">
            <strong>Student Portal</strong>
            <span>Management System</span>
          </div>

          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* ── Section caption ─────────────────────────────── */}
        <div className="sidebar-section">
          <span className="sidebar-caption">WORKSPACE</span>
        </div>

        {/* ── Navigation (permission-gated) ────────────────── */}
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `nav-link${isActive ? " nav-link--active" : ""}`
                }
                onClick={onClose}
              >
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* ── Logout (bottom) ─────────────────────────────────
            Visible to ALL users regardless of permissions.
            The button looks like a nav item but is styled with
            a subtle red tint on hover to signal "destructive
            action".
        */}
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
          >
            <LogOut size={19} strokeWidth={1.8} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
