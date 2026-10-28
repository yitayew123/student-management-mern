import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import DashboardPage from "../features/dashboard/DashboardPage";
import LoginPage from "../features/auth/LoginPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import NotFoundPage from "../pages/NotFoundPage";
import UnauthorizedPage from "../pages/UnauthorizedPage";
import { AuthProvider } from "../contexts/AuthContext";
// ✅ Real feature pages — no more FeaturePlaceholder in this router.
// The FeaturePlaceholder component still exists in the codebase for
// future pre-launch routes (e.g., a new feature area before its page
// is built), but no current route uses it.
import StudentsPage from "../features/students/pages/StudentsPage";
import CoursesPage from "../features/courses/pages/CoursesPage";
import EnrollmentsPage from "../features/enrollments/pages/EnrollmentsPage";
// ✅ Admin-only user account management.
import UserAccountsPage from "../features/users/UserAccountsPage";
// ✅ Role ↔ permission matrix editor (permission-gated, not role-gated).
import RolePermissionsPage from "../features/rolePermissions/RolePermissionsPage";

/**
 * Route → tab title mapping. Used by RouteEffects below to update
 * `document.title` on every navigation (WCAG 2.4.2).
 *
 * Every route the app recognizes should be in this map. Unrecognized
 * routes fall back to "Page not found" — which covers the 404 case.
 */
const pageTitles = {
  "/": "Dashboard",
  "/students": "Students",
  "/courses": "Courses",
  "/enrollments": "Enrollments",
  // ✅ ADDED: admin-only route.
  "/users": "User Accounts",
  // ✅ ADDED: permission-gated route (see route block below).
  "/role-permissions": "Role Permissions",
  "/login": "Sign in",
  "/unauthorized": "Access denied",
};

/**
 * RouteEffects — side-effect-only component that runs on every
 * route change. Renders nothing (returns null).
 *
 * Two concerns handled here:
 *   1. `document.title` update — WCAG 2.4.2
 *   2. Focus management — WCAG 2.4.3
 *
 * Focus management is subtle because some routes handle their OWN
 * focus (NotFoundPage and UnauthorizedPage focus their h1 on
 * mount). If this effect ran unconditionally, it would overwrite
 * those — making SR users hear "main, main content" instead of the
 * more specific "Page not found, heading level 1".
 *
 * The `activeElement === body` guard solves this: after a child page
 * focuses its heading (during its own useEffect, which runs BEFORE
 * this parent effect), `activeElement` is no longer `<body>`, so
 * this fallback is skipped. If no child focused anything
 * (DashboardPage, StudentsPage, CoursesPage, EnrollmentsPage,
 * UserAccountsPage, RolePermissionsPage — none of these focus on
 * mount currently), we fall back to `#main-content`.
 *
 * ⚠️ ASSUMPTION: `#main-content` has `tabIndex={-1}` on its `<main>`
 * element (in AppShell.jsx). Without it, `.focus()` is a no-op.
 *
 * ⚠️ KNOWN GAP: `/login` and `/unauthorized` don't have a
 * `#main-content` element — they use their own `<main className="auth-page">`.
 * UnauthorizedPage has its own focus mgmt (h1 ref). LoginPage does NOT
 * — so this fallback silently no-ops on the login route. Fix: either
 * add `id="main-content"` + `tabIndex={-1}` to LoginPage's `<main>`,
 * or add a heading-ref focus effect inside LoginPage.jsx.
 */
function RouteEffects() {
  const { pathname } = useLocation();

  useEffect(() => {
    // 1. Tab title (WCAG 2.4.2)
    document.title = `${pageTitles[pathname] ?? "Page not found"} — CampusFlow`;

    // 2. Focus management (WCAG 2.4.3)
    // Skip if a child page already moved focus (they run first).
    if (document.activeElement !== document.body) return;

    document.getElementById("main-content")?.focus();
  }, [pathname]);

  return null;
}

/**
 * AppRoutes — the app's full router tree.
 *
 * Structure:
 *   BrowserRouter
 *     └ AuthProvider           (must be above useAuth consumers)
 *        ├ RouteEffects       (title + focus on every navigation)
 *        └ Routes
 *           ├ /login          → LoginPage (handles own loading + redirect)
 *           ├ /unauthorized   → UnauthorizedPage
 *           ├ ProtectedRoute                  (auth gate — any signed-in user)
 *           │  └ MainLayout
 *           │     ├ /            → DashboardPage       (real)
 *           │     ├ /students    → StudentsPage        (real)
 *           │     ├ /courses     → CoursesPage         (real)
 *           │     ├ /enrollments → EnrollmentsPage     (real)
 *           │     ├ ProtectedRoute (admin role gate)
 *           │     │  └ /users    → UserAccountsPage    (real, admin-only)
 *           │     └ ProtectedRoute (permission gate: role_permissions.read)
 *           │        └ /role-permissions → RolePermissionsPage (real)
 *           └ *              → NotFoundPage
 *
 * The nested `ProtectedRoute` around `/users` is what makes that route
 * admin-only. Middleware composition works like this:
 *   1. Outer ProtectedRoute: user must be signed in (any role).
 *   2. MainLayout: renders the sidebar + header shell.
 *   3. Inner ProtectedRoute: user.role must be "admin".
 *   4. UserAccountsPage: renders only when all three pass.
 *
 * An instructor visiting `/users` reaches step 3, fails, and is
 * redirected to `/unauthorized` — outside MainLayout. No flash of
 * the admin page.
 *
 * `/role-permissions` follows the SAME layered pattern, but its
 * inner gate is permission-based (see the route block for the
 * rationale — permission gates auto-follow the matrix; role gates
 * hard-code who can see the page).
 */
export default function AppRoutes() {
  return (
    <BrowserRouter>
      {/*
        AuthProvider MUST be inside BrowserRouter (in case auth logic
        ever needs useNavigate) but OUTSIDE Routes (so all route
        components can call useAuth). If you later move the router
        up to main.jsx, ensure AuthProvider stays inside it and
        above Routes.
      */}
      <AuthProvider>
        <RouteEffects />

        <Routes>
          {/*
            LoginPage handles its own `loading` and `user` states
            internally (redirects to "/" if already authenticated,
            shows Spinner while session-restore runs). No wrapper
            needed — it's self-guarding.
          */}
          <Route path="/login" element={<LoginPage />} />

          {/*
            UnauthorizedPage is public — user IS authenticated (they
            passed ProtectedRoute to get here), but they lack a role.
            Making it public prevents any redirect-loop if role
            checks ever tighten further.
          */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/*
            Protected route block — every route inside requires
            authentication. ProtectedRoute redirects unauthenticated
            users to /login (with `state.from` set for post-login
            return).
          */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<DashboardPage />} />

              {/* ✅ SWAPPED: real Students page (was FeaturePlaceholder). */}
              <Route path="students" element={<StudentsPage />} />

              {/* ✅ SWAPPED: real Courses page (was FeaturePlaceholder). */}
              <Route path="courses" element={<CoursesPage />} />

              {/* ✅ SWAPPED: real Enrollments page (was FeaturePlaceholder). */}
              <Route path="enrollments" element={<EnrollmentsPage />} />

              {/*
                ✅ NEW: admin-only user account management.

                Nested `ProtectedRoute` adds a SECOND role check on
                top of the outer auth gate. Instructors reach this
                node, fail the `allowedRoles` check, and are
                redirected to `/unauthorized`.

                Two layers of protection:
                  - API: `/api/admin/users` routes have
                    `authorize("admin")` at the backend.
                  - UI: this route gate prevents the page from
                    rendering at all.
                Even if someone bypasses the frontend (e.g., via
                the API directly), the backend rejects them with 403.
              */}
              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="users" element={<UserAccountsPage />} />
              </Route>

              {/*
                Role Permissions — gated by PERMISSION, not role.

                `requiredPermissions` (vs `allowedRoles`) means the
                gate auto-follows the permission matrix: if an admin
                later grants `role_permissions.read` to a non-admin
                role — or to a single user via override — that user
                can access this page without a code change here.
                Role gating would hard-code the allow-list and drift
                from the matrix the page itself edits.

                Same two-layer defense as `/users`:
                  - API: `/api/admin/role-permissions` requires
                    `role_permissions.read` at the backend.
                  - UI: this gate blocks rendering entirely.
                Bypassing the frontend still hits the backend 403.

                ⚠️ DEPENDS ON: `ProtectedRoute` accepting a
                `requiredPermissions` prop (array of permission
                strings, "any-of" semantics, checked against
                `user.permissions`). Verify before deploy —
                if the prop isn't supported, this route fails open
                or throws.
              */}
              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={["role_permissions.read"]}
                  />
                }
              >
                <Route
                  path="role-permissions"
                  element={<RolePermissionsPage />}
                />
              </Route>
            </Route>
          </Route>

          {/*
            404 catch-all. Placed LAST so more specific routes win.

            ⚠️ DESIGN NOTE: this is OUTSIDE ProtectedRoute — so
            logged-out users hitting a bad URL see the 404 page
            (not the login page). Both are defensible:
              - "This URL doesn't exist, regardless of auth" (current)
              - "You must log in first to see anything" (alternative)
            If you want the alternative, move `<Route path="*" />`
            INSIDE the ProtectedRoute block — unauthenticated users
            would then get bounced to /login before seeing 404.
          */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
