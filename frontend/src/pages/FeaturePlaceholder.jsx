import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";
import EmptyState from "../components/ui/EmptyState";

/**
 * FeaturePlaceholder — interim page for features not yet built.
 *
 * Serves three routes: /students, /courses, /enrollments. Each
 * shows contextual text + a "coming soon" empty state so the
 * navigation feels complete before the full feature lands.
 *
 * A11Y NOTES:
 *
 *   - Route changes focus the page heading (see effect below).
 *     Without this, keyboard/SR users navigating via the sidebar
 *     land on the new route with focus still on the sidebar link
 *     — WCAG 2.4.3.
 *
 *   - The wrapper uses `key={pathname}` so React remounts the
 *     subtree on route change between placeholders. Some screen
 *     readers only announce content swaps on remount (not on
 *     text-node mutation) — this makes the change unmistakable.
 *
 *   - `document.title` is NOT updated here. That's a global
 *     concern — implement once via a router-level effect (see
 *     the follow-up note below). Adding it only to this page
 *     would create inconsistency with DashboardPage and future
 *     pages.
 */
const pageDetails = {
  "/students": {
    title: "Student management",
    description: "Register, search, update, and manage student records.",
  },
  "/courses": {
    title: "Course management",
    description:
      "Create courses, manage capacity, and maintain course information.",
  },
  "/enrollments": {
    title: "Enrollment management",
    description:
      "Manage student enrollments, cancellations, and enrollment history.",
  },
};

export default function FeaturePlaceholder() {
  const { pathname } = useLocation();
  const page = pageDetails[pathname];
  const headingRef = useRef(null);

  // ✅ ADDED: focus the page heading on route change.
  //
  // Fires on:
  //   - Initial mount (direct URL navigation, bookmark, refresh)
  //   - Every subsequent pathname change within this component
  //     (e.g., /students → /courses via sidebar)
  //
  // Belt-and-suspenders for SR users:
  //   - `.focus()` moves focus AND scrolls h1 into view
  //   - Some SRs announce "Student management, heading level 1"
  //     — confirming the page changed
  //   - Next Tab lands on the first interactive element in the
  //     page, not the next sidebar item
  useEffect(() => {
    headingRef.current?.focus();
  }, [pathname]);

  return (
    // ✅ ADDED: `key={pathname}` — forces a fresh DOM subtree on
    // route change. React Router keeps this component mounted
    // across the three routes; without `key`, only the text
    // content of h1/p changes (SRs may not re-announce). Remount
    // is cheap (small component, no state) and makes the change
    // unambiguous. Complements the focus effect above.
    <div className="placeholder-page" key={pathname}>
      <div className="page-kicker">ACADEMIC MANAGEMENT</div>

      {/* ✅ ADDED: `ref` + `tabIndex={-1}`.
          - `ref` enables the focus call above
          - `tabIndex={-1}` allows JS focus but keeps h1 out of
            the natural Tab order (users won't Tab onto it,
            only JS will focus it)
          - CSS note: if the browser shows a focus outline on
            this element when programmatically focused, add
            `.placeholder-page h1:focus { outline: none }` to
            the stylesheet. See "CSS check" below. */}
      <h1 ref={headingRef} tabIndex={-1}>
        {page?.title || "Management"}
      </h1>

      {/* ✅ CHANGED: conditional render — no empty `<p>` when
          `page` is undefined (e.g., trailing slash in URL,
          case mismatch). Previously rendered `<p></p>`. */}
      {page?.description && <p>{page.description}</p>}

      <div className="content-card placeholder-card">
        <EmptyState
          icon={Construction}
          title="Feature foundation ready"
          description="The shared layout and design system are ready. The complete feature implementation will be added in its dedicated phase."
        />
      </div>
    </div>
  );
}
