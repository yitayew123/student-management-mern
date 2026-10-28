import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "./Button";

/**
 * Pagination — previous/next navigation for paginated lists.
 *
 * Pattern: compact prev/next only (no numbered page buttons).
 * Simpler than a full paginator, and works well for tables where
 * the primary filter is a search/filter above the list, not
 * directly jumping to page 47.
 *
 * A11Y NOTES:
 *
 *   - `<nav aria-label="Pagination">` provides a navigation
 *     landmark — required when the app has multiple `<nav>`
 *     elements (sidebar, breadcrumbs, etc.).
 *
 *   - The page summary uses `role="status"` (polite live region)
 *     so screen readers announce the new page number after a
 *     click. Without it, SR users hear the button click but get
 *     no confirmation the page changed.
 *
 *   - Prev/Next buttons use native `disabled` — appropriate for
 *     pagination (screen readers know disabled buttons are
 *     unavailable). See the "Focus loss" note below for the
 *     trade-off.
 *
 *   - Icons are `aria-hidden` — decorative, the button label
 *     already conveys meaning ("Previous page", "Next page").
 *
 * Props:
 *   page         → current 1-based page number
 *   totalPages   → total page count (0 or negative are clamped to 1)
 *   onPageChange → (newPage: number) => void
 *   className    → extra classes on the `<nav>` (layout overrides)
 *   ...props     → spread onto the `<nav>` (id, data-testid, etc.)
 *
 * FOCUS-MANAGEMENT NOTE (caller's responsibility):
 *
 *   When the user is on the second-to-last page and clicks
 *   "Next", the button becomes `disabled` after the page changes.
 *   Because disabled buttons lose focus, keyboard focus falls back
 *   to the document body — the user "loses their place" and must
 *   Tab from the top again.
 *
 *   The clean fix is for the CALLER to move focus to the results
 *   heading after page changes:
 *
 *     const resultsRef = useRef(null);
 *
 *     // In your page component:
 *     <h2 ref={resultsRef} tabIndex={-1}>Students</h2>
 *     <Pagination
 *       page={page}
 *       totalPages={totalPages}
 *       onPageChange={(next) => {
 *         setPage(next);
 *         resultsRef.current?.focus();
 *       }}
 *     />
 *
 *   This is the standard pattern and it also helps SR users — the
 *   focused heading tells them where they are. Not implemented in
 *   this component because it can't know where the results region
 *   lives.
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className = "",
  ...props
}) {
  // Clamp to at least 1 — display logic assumes a valid page.
  // Prevents "Page 1 of 0" when a fresh list has no data yet
  // (totalPages=0 in an empty state). The Next button will be
  // disabled correctly (1 >= 1), so the state is self-consistent.
  const safeTotalPages = Math.max(1, totalPages);

  return (
    // ✅ ADDED: `className` + `{...props}` passthrough — matches
    // every other UI primitive (Button/Input/Select/Textarea/
    // Alert/Spinner/EmptyState). Enables `data-testid`, layout
    // overrides, `id` for `aria-describedby` references, etc.
    <nav
      className={`pagination ${className}`.trim()}
      aria-label="Pagination"
      {...props}
    >
      {/*
        ✅ FIXED: added `role="status"` — polite live region.
        Without it, clicking Next/Previous updates the visible text
        but announces nothing to screen readers. The user hears
        "Next page, button" then silence — they must assume the
        navigation worked.

        `role="status"` implies `aria-live="polite"` (no explicit
        aria-live needed — same redundancy rule as Spinner). The
        announcement is non-interrupting, so it fires after the
        user finishes hearing "Next page, button".
      */}
      <span className="pagination-summary" role="status">
        Page <strong>{page}</strong> of <strong>{safeTotalPages}</strong>
      </span>

      <div className="pagination-actions">
        {/*
          ⚠️ NOTE on `aria-label` + visible text:
          Buttons have visible text ("Previous" / "Next") AND
          `aria-label="Previous page"` / `"Next page"`. The
          aria-label overrides the visible text for SR — so the
          announcement is "Previous page, button" instead of
          "Previous, button". Slightly redundant but adds context
          ("page" vs. "section" vs. "photo"). Keep it.

          ⚠️ DISABLED BUTTON FOCUS LOSS (see component doc above):
          When the user reaches the last page and Next becomes
          disabled, keyboard focus may fall back to `<body>`.
          Handled by the caller's focus-management pattern, not
          here.
        */}
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          {/*
            ✅ ADDED: `aria-hidden="true"` on both chevrons —
            decorative. The button's aria-label already conveys
            "Previous page" / "Next page". Without this, some SRs
            announce "Previous page, button, graphic" — the phantom
            "graphic" adds no information.
          */}
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
