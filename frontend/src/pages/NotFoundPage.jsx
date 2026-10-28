import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * NotFoundPage — 404 fallback for unrecognized routes.
 *
 * Renders when a URL doesn't match any route (`<Route path="*">`
 * in the router config). Depending on router setup, this may render
 * inside the app shell (with sidebar) or standalone — the styling
 * works in both cases.
 *
 * A11Y NOTES:
 *
 *   - ⚠️ CRITICAL: The "Back to dashboard" CTA is a `<Link>` styled
 *     with button classes — NOT a `<Button>` wrapped in a `<Link>`.
 *
 *     Wrapping a button inside an anchor produces
 *     `<a><button>...</button></a>`, which is invalid HTML
 *     (interactive content inside interactive content) and causes:
 *       - SRs announce "link, button" — confusing dual role
 *       - Enter key may navigate TWICE (once per element)
 *       - Right-click / Cmd+click only work on the anchor region
 *       - Focus ring draws on both elements
 *
 *     The pattern below uses the button's CSS classes directly on
 *     the anchor — visual appearance is identical, semantics are
 *     correct (link, not button). This is the standard fix and
 *     preserves anchor behaviors (open in new tab, copy link,
 *     SEO-friendly URL).
 *
 *   - Focus moves to the h1 on mount so SR users who land here
 *     (via bad URL, redirect, or back-button quirk) immediately
 *     hear "Page not found" instead of silence.
 *
 *   - The "404" is marked `aria-hidden="true"` — the h1 already
 *     conveys the primary message. Screen readers reading "four
 *     hundred four" before "Page not found" is noise.
 */
export default function NotFoundPage() {
  const headingRef = useRef(null);

  // ✅ ADDED: focus the heading on mount. This is what makes
  // landing on a 404 (via bad URL, redirect, or bookmarked-but-
  // broken link) announce meaningfully to screen readers. Without
  // this, focus stays on <body> and SRs say nothing.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="not-found-page">
      {/*
        ✅ ADDED: `aria-hidden="true"` — decorative. The h1 already
        says "Page not found", which is the message users need.
        Reading "four hundred four, Page not found" is redundant
        and slightly confusing ("is 404 a heading?").
      */}
      <span className="not-found-code" aria-hidden="true">
        404
      </span>

      {/* ✅ ADDED: `ref` + `tabIndex={-1}` — enables the focus call
          above. `tabIndex={-1}` keeps h1 out of the natural Tab
          order (users won't Tab onto it) but allows JS focus. */}
      <h1 ref={headingRef} tabIndex={-1}>
        Page not found
      </h1>

      <p>The page you are looking for does not exist or has moved.</p>

      {/*
        🔴 BUG FIX: was `<Link><Button>...</Button></Link>`.

        That produced invalid HTML: `<a><button>...</button></a>`.
        Symptoms:
          - SR reads "link, button" — double role
          - Enter activates the link (navigates) then the button
            (which also tries to navigate via... nothing, because
            Button has no onClick — so it fires the parent link
            AGAIN). Net result: two navigations.
          - Right-click doesn't offer "Open in new tab" if the
            click lands on the button region.
          - Focus ring appears on both the anchor and the button.

        FIX: apply the button CSS classes directly to the `<Link>`.
        Visual appearance is identical (same classes). Semantics are
        correct (`role="link"` only, not `button link`). Browser
        behaviors (Cmd+click, right-click, middle-click) work
        normally across the whole element.
      */}
      <Link to="/" className="ui-button ui-button--primary ui-button--md">
        {/* ✅ ADDED: `aria-hidden="true"` — the icon is decorative.
            The text "Back to dashboard" conveys the meaning. */}
        <ArrowLeft size={17} aria-hidden="true" />
        Back to dashboard
      </Link>
    </div>
  );
}
