import { useId } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Alert from "./Alert";

/**
 * ConfirmDialog — confirmation modal for destructive or important
 * actions ("Delete student?", "Archive course?", etc.).
 *
 * Composes Modal + Button + Alert. The caller owns the async flow:
 *
 *   const [loading, setLoading] = useState(false);
 *   const [open, setOpen] = useState(false);
 *
 *   async function handleConfirm() {
 *     setLoading(true);
 *     try {
 *       await api.delete(`/students/${id}`);
 *       setOpen(false);
 *     } finally {
 *       setLoading(false);
 *     }
 *   }
 *
 *   <ConfirmDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onConfirm={handleConfirm}
 *     loading={loading}
 *     title="Delete student"
 *     message={`Permanently delete ${name}? This cannot be undone.`}
 *     confirmText="Delete"
 *     danger
 *   />
 *
 * A11Y:
 *   - The `message` is linked to the dialog via `aria-describedby`,
 *     so screen readers announce the title AND the question in one
 *     pass: "Delete student, dialog. Permanently delete Abebe? This
 *     cannot be undone." No manual navigation required.
 *
 *   - The Alert (when danger=true) uses role="alert" internally —
 *     so the warning ("This action may affect existing records") is
 *     announced assertively alongside the dialog. Reasonable; the
 *     warning is important context.
 *
 * ⚠️ Known limitation — initial focus:
 *   Modal focuses the FIRST focusable element, which is the X
 *   (close) button in the modal header. For a confirm dialog,
 *   focus on Cancel (safe default) or Confirm (explicit intent)
 *   would be better UX. Fixing requires Modal support for an
 *   `initialFocusRef` prop (not implemented). Current behavior
 *   works but requires the user to Tab once to reach Cancel.
 *
 * ⚠️ Interaction behavior:
 *   During `loading=true`, this component blocks the Escape key,
 *   backdrop click, and X click via `handleClose` — all routes to
 *   `onClose` are guarded. The Cancel button is also disabled.
 *   Result: while the request is in flight, the dialog cannot be
 *   dismissed. This is intentional — dismissing mid-request would
 *   confuse the user about the actual outcome.
 *
 * Props:
 *   open        → boolean; controls visibility
 *   onClose     → () => void; called on Cancel / Escape / backdrop / X.
 *                 Ignored during loading.
 *   onConfirm   → () => void; called on Confirm click. Caller is
 *                 responsible for setting loading=true while
 *                 processing and calling onClose on success.
 *   title       → string; dialog title (aria-labelledby target)
 *   message     → string | ReactNode; the question being asked.
 *                 Pass context-specific text — the default is
 *                 generic ("Are you sure you want to continue?").
 *   confirmText → string; confirm button label
 *   cancelText  → string; cancel button label
 *   loading     → boolean; disables both buttons + blocks dismissal
 *   danger      → boolean; when true, renders the warning Alert
 *                 and uses the danger button variant
 */
export default function ConfirmDialog({
  open,
  title = "Confirm action",
  message = "Are you sure you want to continue?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onClose,
  danger = false,
}) {
  // Stable id for `aria-describedby` linkage — the `<p>` below
  // gets this id, and Modal spreads `aria-describedby` onto the
  // panel via `{...props}`. Result: SRs announce both the title
  // and the message on open, without the user having to navigate.
  const messageId = useId();

  // ✅ ADDED: close guard — blocks Escape, backdrop click, X button,
  // and the Cancel button while `loading` is true.
  //
  // This is the fix for the "dismiss mid-request" bug. Without it,
  // pressing Escape during a delete request would close the dialog
  // while the request continues server-side — user sees the dialog
  // vanish, then gets a success toast later, and has no idea what
  // happened.
  //
  // The Cancel button uses this same handler so its behavior is
  // consistent with the other close paths.
  function handleClose() {
    if (loading) return;
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="sm"
      // ✅ ADDED: `aria-describedby` links the dialog to the message
      // below. Modal spreads `{...props}` onto the panel element, so
      // this lands correctly on the `<div role="dialog">`.
      //
      // Combined with Modal's existing `aria-labelledby={titleId}`,
      // screen readers announce:
      //   "Delete student, dialog. Permanently delete Abebe? This
      //    cannot be undone."
      // in a single utterance on open.
      aria-describedby={messageId}
    >
      <div className="confirm-dialog-content">
        {/* Danger warning — `variant="warning"` uses `role="alert"`
            internally, so this is announced assertively alongside
            the dialog open. Correct for a destructive action. */}
        {danger && (
          <Alert variant="warning">
            This action may affect existing records.
          </Alert>
        )}

        {/* The dialog message — this is what the user is deciding
            about. Accepts either a string OR JSX (e.g., a `<strong>`
            around a record name, or a list of consequences).

            The `id` makes this the target of `aria-describedby`
            above. Do NOT remove it — screen reader users depend on
            it to hear the message alongside the title. */}
        <p id={messageId}>{message}</p>

        <div className="dialog-actions">
          <Button
            variant="outline"
            onClick={handleClose}
            // ✅ Uses `handleClose` (not raw `onClose`) so this
            // button also respects the loading guard.
            disabled={loading}
          >
            {cancelText}
          </Button>

          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            // `loading` prop on Button disables it during the request
            // AND shows the spinner. The Button component handles
            // both — no double-submit possible from this side.
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
