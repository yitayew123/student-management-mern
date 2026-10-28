import { Menu, Search, Bell, ChevronDown } from "lucide-react";

/**
 * Shared window-event names — centralized so listeners elsewhere
 * can import the same constant. Prevents the "app:search" vs
 * "app-search" vs "app:search:open" typo class of bug that plagues
 * ad-hoc window events.
 *
 * ⚠️ ARCHITECTURAL NOTE: window events are a React anti-pattern.
 * They're invisible to the component tree, hard to test, and easy
 * to leak (missing removeEventListener on unmount). Prefer one of:
 *
 *   - Prop drilling:  <AppHeader onSearchClick={openSearch} />
 *   - React Context:  const { openSearch } = useAppShell();
 *   - State store:    const openSearch = useStore(s => s.openSearch);
 *
 * Only keep the window-event pattern if this is a quick bridge
 * until a proper refactor. If you keep it: the LISTENER (likely in
 * App.jsx) must clean up on unmount:
 *   useEffect(() => {
 *     const handler = () => setSearchOpen(true);
 *     window.addEventListener(APP_SEARCH_EVENT, handler);
 *     return () => window.removeEventListener(APP_SEARCH_EVENT, handler);
 *   }, []);
 */
export const APP_SEARCH_EVENT = "app:search";

/**
 * AppHeader — top bar with mobile drawer toggle, search trigger,
 * notifications, and account menu.
 *
 * Props:
 *   onMenuClick  → () => void; opens the mobile navigation drawer.
 *                  Required — passed to the mobile menu button.
 *   open         → boolean | undefined; if provided, drives
 *                  `aria-expanded` on the mobile menu button so
 *                  screen readers announce the drawer's current
 *                  state. Pass it — it costs one prop and closes
 *                  a real WCAG 4.1.2 gap.
 *
 * ⚠️ This component currently renders two "dead" buttons
 * (notifications, account) — they have no onClick. Either wire
 * them to handlers or remove them. A button that looks clickable
 * but isn't is worse than no button.
 */
export default function AppHeader({ onMenuClick, open }) {
  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="icon-button mobile-menu-button"
          aria-label="Open navigation"
          // ✅ FIXED: `aria-expanded` communicates the drawer's
          // current state. Renders the attribute only when `open`
          // is a boolean — React omits `undefined` automatically,
          // so calling <AppHeader onMenuClick={fn} /> without
          // `open` still works without emitting a broken
          // `aria-expanded="false"` when we don't actually know.
          //
          // ⚠️ Requires the parent to pass the sidebar's `open`:
          //   <AppHeader onMenuClick={...} open={sidebarOpen} />
          aria-expanded={typeof open === "boolean" ? open : undefined}
          // Optional: aria-controls="app-sidebar" — but requires
          // <aside id="app-sidebar"> in AppSidebar.jsx. Add both
          // or neither — a dangling aria-controls reference logs
          // SR warnings in some browsers.
          onClick={onMenuClick}
        >
          <Menu size={22} />
        </button>

        <div className="header-heading">
          {/* ⚠️ HARDCODED: if the app is ever multi-tenant or
              white-labeled, this text should come from a config
              or env var. Currently fine for a single-app
              deployment. */}
          <span className="header-eyebrow">STUDENT MANAGEMENT</span>
          <span className="header-context">Management workspace</span>
        </div>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="icon-button header-search"
          aria-label="Search"
          title="Search"
          // Uses the shared event-name constant so a listener
          // elsewhere can import the same string (no typos). Still
          // an architectural smell — see the note above.
          onClick={() => window.dispatchEvent(new Event(APP_SEARCH_EVENT))}
        >
          <Search size={19} />
        </button>

        <button
          type="button"
          className="icon-button notification-button"
          aria-label="Notifications"
          title="Notifications"
          // 🔴 DEAD BUTTON: no onClick. Clicking does nothing.
          //
          // When you wire this to a notification panel, add:
          //   aria-haspopup="menu"        (or "dialog" / "true")
          //   aria-expanded={panelOpen}
          //   onClick={() => setPanelOpen(v => !v)}
          //
          // If a notifications panel isn't planned yet, REMOVE
          // the button entirely — a non-functional bell teaches
          // users to distrust the UI.
        >
          <Bell size={19} />
        </button>

        {/* Decorative separator — hidden from screen readers to
            avoid an unexplained gap in the announcement. */}
        <div className="header-divider" aria-hidden="true" />

        <button
          type="button"
          className="profile-button"
          // ✅ FIXED: label now matches the visual promise.
          // Previously said "Account menu" but no menu existed.
          // Since a ChevronDown implies a dropdown, this button
          // SHOULD open a menu — the missing piece is `onClick`.
          aria-label="Account menu"
          // ✅ Added: tells SRs a menu should appear on activation.
          aria-haspopup="menu"
          // 🔴 DEAD BUTTON: same as notifications — no onClick.
          // When wired, add:
          //   aria-expanded={accountMenuOpen}
          //   onClick={() => setAccountMenuOpen(v => !v)}
          //
          // If no menu is planned, remove `aria-haspopup`, rename
          // to "Account settings", remove the ChevronDown, and
          // make it navigate to /account or similar.
        >
          {/*
            ⚠️ HARDCODED USER DATA — this is a real bug, not just
            a placeholder:

            - "AD" — avatar initials
            - "Administrator" — display name
            - "Management" — role/context

            All three should come from the authenticated user:

              const { user } = useAuth();
              const initials = `${user.firstName[0]}${user.lastName[0]}`;

            Right now every logged-in user sees "AD / Administrator"
            regardless of who they are. For an admin-only dashboard
            this might be acceptable short-term, but the moment you
            add non-admin users (instructors via /api/auth/login),
            the header lies about their identity.

            Fix by wiring `useAuth()` or passing the user as a prop.
          */}
          <span className="avatar">AD</span>
          <span className="profile-copy">
            <strong>Administrator</strong>
            <small>Management</small>
          </span>
          {/* ChevronDown is not aria-hidden — but that's fine,
              because the parent button's aria-label overrides the
              computed name. SR announces "Account menu, button"
              and ignores the visual children. */}
          <ChevronDown size={16} />
        </button>
      </div>
    </header>
  );
}
