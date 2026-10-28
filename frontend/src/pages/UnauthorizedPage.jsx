import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

/**
 * UnauthorizedPage — rendered when an authenticated user lacks the
 * role required for a page (via `<ProtectedRoute allowedRoles={[...]}>`).
 *
 * This is different from:
 *   - NotFoundPage     → URL doesn't match any route
 *   - LoginPage        → user isn't authenticated at all
 *
 * UnauthorizedPage is specifically: "I know who you are, but you're
 * not allowed here." That distinction matters for messaging — telling
 * the user they're logged in prevents them from thinking they got
 * logged out and retrying credentials.
 *
 * A11Y NOTES:
 *
 *   - Focus moves to the h1 on mount. Without this, screen reader
 *     users redirected here from `/admin` (or similar) hear silence
 *     — focus stays on <body> with no announcement of the redirect.
 *     WCAG 2.4.3.
 *
 *   - The h1's `id` is referenced by `<section aria-labelledby>`,
 *     so screen readers announce the section as "Access denied,
 *     region" — properly named landmark.
 *
 *   - `document.title` is NOT updated here. That's a global concern
 *     handled by `RouteEffects` in `AppRoutes.jsx` (via the
 *     `pageTitles` map). Verify the map has an entry for
 *     `/unauthorized` — otherwise the tab title falls back to
 *     "Page not found — CampusFlow" which is misleading.
 *
 *   - Uses `<Link className="auth-submit">` — NOT `<Link><Button></Link>`.
 *     The latter produces invalid `<a><button>` HTML with dual roles,
 *     double-activation, and broken right-click behavior. This is
 *     the same pattern fix applied in `NotFoundPage`.
 *
 * ⚠️ Design consideration — potential loop:
 *   The "Return to dashboard" link goes to `/`. If the dashboard
 *   itself is role-restricted AND the current user lacks that role,
 *   they'll loop back to this page. In most apps `/` (dashboard) is
 *   accessible to all authenticated users, so this isn't an issue.
 *   But if your dashboard ever becomes role-gated (e.g., only
 *   admin/instructor can see metrics), the fallback target should
 *   be a page everyone can access — like `/profile` or `/login`
 *   (with logout).
 */
export default function UnauthorizedPage() {
  const headingRef = useRef(null);

  // ✅ ADDED: focus the heading on mount. Screen reader users who
  // get redirected here (via `<Navigate to="/unauthorized" />` from
  // ProtectedRoute) would otherwise stay focused on <body> — no
  // announcement, no context. Moving focus to the h1 announces
  // "Access denied, heading level 1" so the user immediately
  // understands what happened.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    // ⚠️ `<main>` is correct here — this page is standalone (not
    // inside MainLayout), so it needs its own top-level main landmark.
    // If you ever move this inside MainLayout, change to a plain
    // wrapper (e.g., `<div>`) — otherwise you'll have TWO <main>
    // elements (one from MainLayout, one here), which is invalid HTML.
    <main className="auth-page">
      {/* `<section aria-labelledby>` creates a named landmark
          ("Access denied, region") — helps SR users navigate directly
          to the denial message via the landmark list. Slightly
          redundant with `<main>` being a landmark too, but harmless
          and semantically richer (this region has a name). */}
      <section className="auth-card" aria-labelledby="unauthorized-title">
        {/* ✅ ADDED: `ref` + `tabIndex={-1}`.
            - `ref` enables the focus call in useEffect above
            - `tabIndex={-1}` keeps the h1 out of the natural Tab
              order (users won't Tab onto it) but allows JS focus.
            - If you see a focus outline on the h1 after redirect,
              add `.auth-card h1:focus { outline: none }` to CSS —
              see the CSS check below. */}
        <h1 id="unauthorized-title" ref={headingRef} tabIndex={-1}>
          Access denied
        </h1>

        <p>
          You are signed in, but your account does not have permission to access
          this page.
        </p>

        {/* ✅ CORRECT PATTERN: `<Link>` with button styling via
            `className`. Not wrapped in a `<Button>` component — that
            would create invalid `<a><button>` nesting with the
            problems we fixed in NotFoundPage (dual role, right-click
            broken on part of the element, double Enter/Space fires).

            `className="auth-submit"` must be styled to LOOK like a
            button — see CSS check below. If `.auth-submit` doesn't
            exist, this renders as a plain underlined link, which
            still works but looks inconsistent. */}
        <Link className="auth-submit" to="/">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
