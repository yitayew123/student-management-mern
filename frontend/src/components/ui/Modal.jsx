import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Modal — accessible dialog with focus management, body scroll
 * lock, and keyboard navigation.
 *
 * Behaviors implemented (all required for `aria-modal="true"` to
 * be more than a decorative attribute):
 *
 *   1. Portal to document.body — escapes any parent stacking context
 *   2. Body scroll lock — page behind the modal can't scroll
 *   3. Initial focus — first focusable element (or the panel itself)
 *      receives focus on open, so keyboard users land inside
 *   4. Focus trap — Tab/Shift+Tab cycle within the modal only
 *   5. Focus return — on close, focus returns to the element that
 *      opened the modal
 *   6. Escape to close
 *   7. Backdrop click to close (guarded so drag-out doesn't close)
 *
 * ⚠️ When NOT to use this Modal:
 *   - For inline tooltips/popovers — use a positioned popover pattern
 *   - For destructive confirms where you want to force explicit
 *     action — Escape/backdrop close might accidentally dismiss.
 *     Pass a prop like `dismissible={false}` (not implemented) or
 *     use a dedicated ConfirmDialog that omits the escape handler.
 *
 * Props:
 *   open      → boolean; controls mount/unmount
 *   onClose   → () => void; called on Escape / backdrop / X click
 *   title     → string; used as the dialog's accessible name and
 *               rendered as an `<h2>`. If omitted, the dialog gets
 *               a hidden fallback "Dialog" heading so SRs still
 *               announce it correctly.
 *   children  → modal body content
 *   size      → "sm" | "md" | "lg" (default "md"); unknown values
 *               fall back to "md"
 *   className → extra classes on the panel (layout overrides)
 *   ...props  → spread onto the panel (`id`, `data-testid`, etc.)
 *
 * ⚠️ PERFORMANCE NOTE (important, easy to miss):
 *   `onClose` is a dependency of the effect that wires up the
 *   keydown listener and body scroll lock. If the caller passes an
 *   inline arrow (`onClose={() => setOpen(false)}`), the effect
 *   re-runs on EVERY parent render — removing and re-adding the
 *   listener, restoring and re-hiding overflow, and worse, losing
 *   and re-grabbing the previously-focused element. Users may
 *   notice focus flickering.
 *
 *   The caller should wrap `onClose` in `useCallback`:
 *
 *     const close = useCallback(() => setOpen(false), []);
 *
 *   Or accept the flicker for simple cases where the parent rarely
 *   re-renders while the modal is open.
 */

const VALID_SIZES = ["sm", "md", "lg"];

// Selector for "focusable elements" — used both for initial focus
// and for the focus trap. Excludes disabled controls and hidden
// elements. Kept inline (not extracted to a constant) so it stays
// close to where it's used.
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  className = "",
  ...props
}) {
  // Stable id for `aria-labelledby` — links the dialog to its
  // heading. Preferable to `aria-label` because it uses the visible
  // heading text (which is what the user sees).
  const titleId = useId();

  // Ref on the panel — used for initial focus and focus trap queries.
  const panelRef = useRef(null);

  // Tracks the element that had focus BEFORE the modal opened, so
  // we can return focus there on close. This is what makes the modal
  // feel right to keyboard users — Tab opens the dialog, Escape
  // closes it, focus jumps back to the button they came from.
  const previouslyFocusedRef = useRef(null);

  const safeSize = VALID_SIZES.includes(size) ? size : "md";

  useEffect(() => {
    if (!open) return undefined;

    // ── Save focus origin + lock body scroll ─────────────────
    previouslyFocusedRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // ── Initial focus ────────────────────────────────────────
    // `requestAnimationFrame` defers until after the portal has
    // actually rendered into the DOM. Without it, `panelRef.current`
    // may be null when this effect runs (React hasn't committed
    // the portal yet).
    const rafId = requestAnimationFrame(() => {
      if (!panelRef.current) return;
      const firstFocusable = panelRef.current.querySelector(FOCUSABLE_SELECTOR);
      // Fall back to the panel itself (which has tabIndex={-1})
      // when the modal body has no focusable elements — a "read
      // only" modal or a loading state.
      (firstFocusable || panelRef.current).focus();
    });

    // ── Keydown handler: Escape + focus trap ────────────────
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = panel.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) {
        // No focusable elements → keep focus on the panel itself.
        // (Otherwise Tab would navigate out of the modal.)
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      // Shift+Tab on the first element → wrap to last
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      // Tab on the last element → wrap to first
      else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    // ── Cleanup ──────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;

      // Return focus to the element that opened the modal.
      // Guard for nodes that have been removed from the DOM (rare
      // but possible if the trigger itself was conditionally rendered).
      const previouslyFocused = previouslyFocusedRef.current;
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === "function" &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  // The panel element changed from `section` to `div`:
  // `section` has an implicit `region` landmark. `role="dialog"`
  // overrides it, but the semantics of `section` (a named region)
  // still leak through in some browser/SR combinations. `div` has
  // no implicit role — the explicit `role="dialog"` is the only
  // meaning, which is exactly what we want.
  return createPortal(
    <div
      className="modal-backdrop"
      // `onMouseDown` (not `onClick`) — the close only fires when
      // the press STARTS on the backdrop. Prevents the classic bug
      // where clicking inside the modal, dragging out, and releasing
      // over the backdrop closes it. Standard pattern.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`modal-panel modal-panel--${safeSize} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        // ✅ FIXED: `aria-labelledby` (not `aria-label`).
        // `aria-label={title}` silently failed when `title` was
        // undefined — the dialog ended up with NO accessible name.
        // Using `aria-labelledby` pointing at the (possibly hidden)
        // heading guarantees a name in every case.
        aria-labelledby={titleId}
        // `tabIndex={-1}` makes the panel focusable programmatically
        // (for the fallback focus case when there are no focusable
        // children) without making it part of the natural Tab order.
        tabIndex={-1}
        {...props}
      >
        <header className="modal-header">
          {/* Always render an `<h2>` so `aria-labelledby` has a
              target. When `title` is missing, render a visually
              hidden fallback — the SR still announces "Dialog,
              dialog" which is better than silent. */}
          <h2 id={titleId} className={title ? undefined : "sr-only"}>
            {title || "Dialog"}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
