import AppShell from "../components/layout/AppShell";

/**
 * MainLayout — the layout wrapper for authenticated application routes.
 *
 * Right now it's a thin pass-through to `AppShell`. That's intentional:
 * this file exists as a stable extension point. Future concerns live
 * here rather than being scattered across page components:
 *
 *   1. Auth guard — the standard place for
 *      `if (!user) return <Navigate to="/login" replace />;`
 *      (or a `<RequireAuth>` wrapper), so every route under this
 *      layout is protected by construction.
 *
 *   2. Route-change analytics — a `useEffect` on `useLocation()`
 *      that fires a page-view event.
 *
 *   3. Error boundary — wrap `<AppShell />` in `<ErrorBoundary>`
 *      to catch render errors in the layout region without
 *      unmounting the whole app.
 *
 *   4. Providers — theme, feature flags, notification context —
 *      anything that should wrap the shell but not the top-level
 *      router.
 *
 * If you're certain none of the above is planned, this file can
 * be removed and routes can render `<AppShell>` directly. But
 * given it's already here and other layouts (e.g., `AuthLayout`
 * for login/register pages) may follow the same pattern, keeping
 * it is the safer default.
 *
 * ⚠️ NOT A PLACE FOR: data fetching (pages own their data),
 * sidebar state (AppShell owns it), route-level auth checks
 * (should be in the router or a wrapper component — a `if (!user)`
 * here would run *after* the shell renders, causing a flash).
 */
export default function MainLayout() {
  return <AppShell />;
}
