import AppRoutes from "./routes/AppRoutes";

/**
 * App — the root component, rendered by `main.jsx`.
 *
 * Currently a no-op wrapper around `<AppRoutes>`. That's correct
 * for the current architecture — no providers, no error boundary,
 * no cross-cutting concerns exist yet to wrap.
 *
 * ── What belongs here (eventually) ─────────────────────────────
 * This is the composition root. When any of the following are
 * introduced, they belong at THIS level — not in AppRoutes, not
 * in individual pages:
 *
 *   - `<BrowserRouter>` — should be moved up from AppRoutes
 *     (see note below) so components ABOVE the router (like an
 *     error boundary using `useNavigate`) can access router hooks.
 *
 *   - `<ErrorBoundary>` — catches render-time errors from any
 *     page, shows a fallback UI. Without it, a single page-level
 *     crash blanks the whole app. This is the #1 addition worth
 *     making before shipping the real feature pages.
 *
 *   - `<Suspense fallback={...}>` — only if you add `React.lazy`
 *     for route-level code splitting. Not needed at current scale.
 *
 *   - Provider components — theme, auth, notifications. Add when
 *     the app has data that must be shared across pages.
 *
 *   - Analytics setup — page-view tracking, user identification.
 *     Add when you need product metrics.
 *
 * ── Why a pass-through is fine today ───────────────────────────
 * Every React app reaches this inflection point differently. Right
 * now the app has exactly one concern (routing) and it lives in
 * AppRoutes. There's no reason to pre-create a composition layer
 * with nothing to compose.
 *
 * The moment you add ANY of the items above — even just one — this
 * file becomes the obvious home for it, and the pass-through turns
 * into a real composition root without disruption.
 *
 * ── The alternative: delete this file ──────────────────────────
 * Some teams remove App.jsx entirely and have `main.jsx` render
 * `<AppRoutes />` directly. That's defensible — fewer indirection
 * layers. The trade-off:
 *   Delete App.jsx      → one less file, but every provider /
 *                         boundary change touches main.jsx or
 *                         AppRoutes.jsx, both of which have other
 *                         responsibilities
 *   Keep App.jsx        → one more file, but the composition seam
 *                         is stable — future providers go here and
 *                         nothing else changes
 *
 * Recommendation: keep it. The cost is 5 lines; the benefit is
 * that the file exists when you need it, with the right name and
 * shape.
 */
export default function App() {
  return <AppRoutes />;
}
