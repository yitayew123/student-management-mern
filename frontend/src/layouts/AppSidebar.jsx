import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  GraduationCap,
  X,
  ChevronRight,
} from "lucide-react";

/**
 * Sidebar navigation config.
 *
 * Module-scope (not inline in the component) so the array is
 * created ONCE, not on every render — prevents React from
 * seeing a "new" array prop on children and re-rendering them
 * unnecessarily. Small win here, big win as the nav grows.
 *
 * Structure: groups → items. The `label` is the section header,
 * items are the clickable links. Order in the array is
 * display order.
 */
const navigation = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", path: "/", icon: LayoutDashboard }],
  },
  {
    label: "Academic management",
    items: [
      { label: "Students", path: "/students", icon: Users },
      { label: "Courses", path: "/courses", icon: BookOpen },
      { label: "Enrollments", path: "/enrollments", icon: ClipboardList },
    ],
  },
];

/**
 * AppSidebar — off-canvas navigation drawer.
 *
 * Props:
 *   open    → boolean; controls visibility + overlay
 *   onClose → () => void; called on overlay click, X click, and
 *             any nav-link click (typical mobile pattern:
 *             close-on-navigate)
 *
 * The parent owns the `open` state and the toggle button. This
 * component is purely presentational + interaction dispatch.
 *
 * ⚠️ A11Y NOTE — verify before shipping:
 *
 * If your CSS hides the closed sidebar with `display: none` or
 * `visibility: hidden`, screen readers already skip it — no action
 * needed below.
 *
 * If your CSS hides it with `transform: translateX(-100%)` (the
 * typical off-canvas drawer), the element is still in the
 * accessibility tree and still keyboard-focusable. That's a real
 * a11y gap: keyboard users tab into an invisible sidebar.
 *
 * Fix in one of two ways:
 *   A) CSS: add `visibility: hidden` to the default `.app-sidebar`
 *      state, `visibility: visible` to `.app-sidebar--open`.
 *      Simplest — no JSX changes.
 *   B) JSX: add `aria-hidden={!open}` AND `inert={!open ? "" : undefined}`
 *      to the `<aside>`. `inert` prevents focus AND removes from
 *      the a11y tree — the modern, complete solution.
 *
 * Do NOT add ONLY `aria-hidden` — that hides from screen readers
 * but leaves the elements keyboard-focusable, creating the
 * "focus lands on nothing" bug. `inert` handles both.
 */
export default function AppSidebar({ open, onClose }) {
  return (
    <>
      {/* Full-screen click target behind the drawer, on mobile
          only. Renders only when open (avoids an invisible
          focusable button covering the app when closed).

          ⚠️ FIXED: added `type="button"` — a `<button>` outside
          any form defaults to `type="submit"`. If this component
          is ever rendered inside a form (unlikely but possible
          via unusual layouts), clicking the overlay would submit
          that form. `type="button"` makes the intent explicit
          and closes the loophole. Matches the close button at
          the top of the sidebar, which already has it. */}
      {open && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}

      {/* The sidebar itself. `app-sidebar--open` toggles visibility
          via CSS. `aria-label` on the `<aside>` provides a landmark
          name; the nested `<nav>` also has an implicit navigation
          role (see note below about redundant announcement). */}
      <aside
        className={`app-sidebar ${open ? "app-sidebar--open" : ""}`}
        aria-label="Main navigation"
      >
        {/* ── Brand / header ─────────────────────────────── */}
        <div className="sidebar-brand">
          <div className="brand-mark">
            <GraduationCap size={25} />
          </div>

          <div className="brand-copy">
            <strong>CampusFlow</strong>
            <span>Student Management</span>
          </div>

          {/* Close button — visible on mobile when the drawer is
              open. `type="button"` prevents form submission if the
              sidebar is ever wrapped in a form. `aria-label`
              distinguishes it from the overlay button (both close,
              but the SR user benefits from knowing which one
              they've reached). */}
          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Static "WORKSPACE" caption — not a nav item, just a
            visual label above the nav. Renders once regardless of
            how many groups exist.

            ⚠️ DESIGN INCONSISTENCY: "WORKSPACE" is hardcoded here,
            but each group below has its own dynamic label
            ("Overview", "Academic management") from the data
            array. If you want section labels to look consistent,
            either:
              - Remove this hardcoded block and add "WORKSPACE" as
                a third group in the `navigation` array, OR
              - Style `.sidebar-caption` the same as
                `.nav-group-label` so both read as section headers.
            As-is, it reads as a page title, then the actual
            section labels appear below — creating a "header
            above a header" hierarchy that may confuse users. */}
        <div className="sidebar-section">
          <span className="sidebar-caption">WORKSPACE</span>
        </div>

        {/* `<nav>` provides the "navigation" landmark for screen
            readers — free, correct, no extra ARIA needed.

            ⚠️ OPTIONAL: if the app has multiple `<nav>` elements
            (breadcrumbs, pagination, footer links), add
            `aria-label="Sidebar"` to this `<nav>` so users can
            distinguish them in the landmark list. Currently the
            `<aside>` above has "Main navigation" but the `<nav>`
            inside gets the generic "navigation" label —
            functionally fine, but specific beats generic. */}
        <nav className="sidebar-navigation" aria-label="Sidebar">
          {navigation.map((group) => (
            <div className="nav-group" key={group.label}>
              {/* Group heading — using `<p>` here is a semantic
                  smell (a `<p>` should be prose, not a label).
                  Better alternatives:
                    - `<h2 className="nav-group-label">` with
                      visually-hidden styling if you don't want
                      it visible as a heading.
                    - `<span className="nav-group-label">` if it's
                      purely decorative text.
                  Current `<p>` works visually but pollutes the
                  paragraph structure for any SR that navigates by
                  paragraph. Minor — leaving as-is matches most
                  nav libraries. */}
              <p className="nav-group-label">{group.label}</p>

              {group.items.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  // `end` only for "/" — otherwise every route
                  // matches "/" and Dashboard stays highlighted
                  // no matter what page you're on. For other
                  // routes, prefix-match is correct: "/students"
                  // stays active when on "/students/123/edit".
                  // Correct use of the react-router API.
                  end={path === "/"}
                  // Close the drawer on navigate — the standard
                  // mobile UX pattern (user taps a destination,
                  // expects to land on it, not still see the nav).
                  // Also fires on desktop, where onClose is
                  // typically a no-op because `open` is already
                  // false. Safe: `onClick={undefined}` is a
                  // no-op in React.
                  onClick={onClose}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "nav-link--active" : ""}`
                  }
                >
                  <Icon size={19} strokeWidth={1.8} />
                  <span>{label}</span>

                  {/* ⚠️ DESIGN QUESTION: Chevron only on the
                      Dashboard link.

                      Chevrons typically signal "this opens a
                      submenu" or "this navigates elsewhere" —
                      implying a difference between the
                      Dashboard and the other links. If that's
                      intentional (e.g., Dashboard is a
                      "featured" CTA), fine. If not, the visual
                      inconsistency makes the nav feel unfinished.

                      Options:
                        - Remove this chevron entirely (simplest)
                        - Add chevrons to every link (heavy)
                        - Only show chevron on hover (subtle cue)
                        - Show chevron only for items with
                          submenus (if you add nesting later) */}
                  {path === "/" && (
                    <ChevronRight size={15} className="nav-chevron" />
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer — brand repeat for visual anchoring. Purely
            decorative; not a link. If this ever becomes
            clickable (e.g., "back to home"), wrap it in a
            `<Link>` and add `onClick={onClose}` to match nav
            behavior. */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-icon">
            <GraduationCap size={20} />
          </div>
          <div>
            <strong>CampusFlow</strong>
            <span>Management workspace</span>
          </div>
        </div>
      </aside>
    </>
  );
}
