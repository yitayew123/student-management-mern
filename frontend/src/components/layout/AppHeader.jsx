import { Menu } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Page title lookup — maps route prefixes to display titles shown in
 * the header.
 *
 * ⚠️ DUPLICATION NOTE: `AppRoutes.jsx` has a similar `pageTitles`
 * map used by `RouteEffects` for `document.title`. If you add a new
 * route, update BOTH places — or better, extract to a shared module
 * (e.g., `src/routes/routeMetadata.js`) imported by both.
 *
 * The array form (not a map) is used here because of the `startsWith`
 * fallback for nested routes — e.g., `/students/123` should still
 * show "Students" as the title. A simple `map[pathname]` lookup
 * couldn't do that.
 */
const pageTitles = [
  { path: "/", title: "Dashboard" },
  { path: "/students", title: "Students" },
  { path: "/courses", title: "Courses" },
  { path: "/enrollments", title: "Enrollments" },
];

export default function AppHeader({ onMenuClick = () => {}, open }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Match exact path first, then prefix-match (for nested routes).
  // The `page.path !== "/"` guard prevents `/` from prefix-matching
  // every route — otherwise "/" would match "/students" too.
  const currentPage = pageTitles.find(
    (page) =>
      location.pathname === page.path ||
      (page.path !== "/" && location.pathname.startsWith(`${page.path}/`)),
  );

  // Fallbacks at every step so the header never shows "undefined":
  //   title       → "Student Management" (generic app context)
  //   displayName → "User" (when user is loading or missing)
  //   role        → "User" (same)
  const title = currentPage?.title ?? "Student Management";
  const displayName = user?.fullName ?? user?.name ?? user?.email ?? "User";
  const role = user?.role ?? "User";

  // Generate avatar initials from the user's name.
  //   "Abebe Kebede"       → "AK"
  //   "Abebe"              → "A"
  //   "Abebe Kebede Alemu" → "AK" (only first two words used)
  //   ""                   → "" (falls back to "U" below)
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  function handleLogout() {
    // Clear auth state first (removes token + sets user to null),
    // then navigate. Order matters — if we navigated first,
    // ProtectedRoute would briefly see the old user still set,
    // let the navigation through, and only then redirect. Cleared
    // state first means /login renders immediately after navigate.
    logout();
    // `replace: true` prevents the back button from returning to a
    // now-protected route (which would immediately redirect back
    // to /login — jarring UX).
    navigate("/login", { replace: true });
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="menu-toggle"
          aria-label="Open navigation menu"
          // ✅ Correct — only renders the attribute when `open` is a
          // boolean. If AppShell doesn't pass `open`, the attribute
          // is omitted (React removes `undefined` automatically).
          aria-expanded={typeof open === "boolean" ? open : undefined}
          onClick={onMenuClick}
        >
          {/*
            🔴 FIXED: replaced `☰` (U+2630 "trigram for heaven")
            with the shared lucide `<Menu>` icon.

            Why:
              - `☰` renders differently on macOS vs Windows vs Linux
              - Some fonts render it larger/smaller/thinner than
                expected
              - Inconsistent with every other icon in the app
                (all lucide)
              - `aria-hidden` on the SVG is required — the button
                already has `aria-label`, so the icon shouldn't be
                announced separately.
          */}
          <Menu size={22} aria-hidden="true" />
        </button>

        <div className="header-page-info">
          <span className="header-eyebrow">WORKSPACE</span>
          {/*
            🔴 FIXED: was `<h1 className="header-title">{title}</h1>`.
            Changed to `<span>`.

            Why:
              - The page itself (DashboardPage, etc.) already has its
                own `<h1>`.
              - Two `<h1>` on one page = WCAG 1.3.1 violation and
                confusing heading navigation for screen readers
                (they jump to the first h1, which is often just
                "Dashboard" in the header — not the actual page
                content they wanted).
              - The header title is contextual reinforcement, not
                the semantic heading of the page. `<span>` is
                correct.
          */}
          <span className="header-title">{title}</span>
        </div>
      </div>

      <div className="header-right">
        {/*
          User info block — decorative on the left (avatar initials
          hidden via aria-hidden because the full name appears next
          to it), useful content on the right.

          ⚠️ NOTE: this block is NOT interactive. Clicking it does
          nothing. If you add an account dropdown (settings, change
          password, etc.) later, change `<div className="header-user">`
          to `<button type="button" className="header-user">` with
          `aria-haspopup="menu"` + `aria-expanded`. For now, keeping
          it as a div is correct — dead-looking buttons erode trust
          more than non-interactive labels do.
        */}
        <div className="header-user">
          <span className="header-avatar" aria-hidden="true">
            {initials || "U"}
          </span>
          <span className="header-user-copy">
            <strong>{displayName}</strong>
            <small>{role}</small>
          </span>
        </div>

        <button
          type="button"
          // 🔴 FIXED: added `type="button"`. Without it, a `<button>`
          // outside a form defaults to `type="submit"` — harmless in
          // practice here since the header isn't in a form, but
          // defensive. If the header ever ends up inside a form
          // (unusual layout, wrapper component), clicking "Sign out"
          // would submit the form AND log out — double action.
          className="header-logout"
          onClick={handleLogout}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
