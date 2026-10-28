import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getErrorMessage } from "../../api/apiErrors";

/**
 * CreateUserModal — modal for creating a student or instructor
 * login account.
 *
 * Props:
 *   open       → boolean
 *   initialRole → "student" | "instructor" (pre-selects the role)
 *   onClose    → () => void
 *   onSubmit   → async (payload) => void; throws on error
 *   submitting → boolean
 */
export default function CreateUserModal({
  open,
  initialRole = "student",
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const modalRef = useRef(null);

  // Reset state when the modal opens; focus on open.
  useEffect(() => {
    if (!open) return;
    setFullName("");
    setEmail("");
    setPassword("");
    setRole(initialRole);
    setShowPassword(false);
    setErrors({});
    setFormError("");
    requestAnimationFrame(() => modalRef.current?.focus());
  }, [open, initialRole]);

  // Escape to close (not during submit).
  useEffect(() => {
    if (!open) return;
    function handleEscape(e) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, submitting, onClose]);

  function validate() {
    const errs = {};
    const n = fullName.trim();
    const em = email.trim();

    if (!n) errs.fullName = "Full name is required.";
    else if (n.length < 2) errs.fullName = "Full name is too short.";

    if (!em) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
      errs.email = "Enter a valid email address.";

    if (!password) errs.password = "Password is required.";
    else if (password.length < 12)
      errs.password = "Password must be at least 12 characters.";
    else if (password.length > 72)
      errs.password = "Password must not exceed 72 characters.";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!validate()) return;

    try {
      await onSubmit({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
    } catch (error) {
      const details = error?.details;
      if (Array.isArray(details)) {
        const fieldErrs = {};
        details.forEach((d) => {
          if (["fullName", "email", "password", "role"].includes(d.field)) {
            fieldErrs[d.field] = d.message;
          }
        });
        if (Object.keys(fieldErrs).length > 0) {
          setErrors((prev) => ({ ...prev, ...fieldErrs }));
          return;
        }
      }
      setFormError(getErrorMessage(error, "Unable to create account."));
    }
  }

  if (!open) return null;

  return (
    <div
      className="user-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <section
        ref={modalRef}
        tabIndex={-1}
        className="user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
      >
        <header className="user-modal-header">
          <h2 id="create-user-title">Create user account</h2>
          <button
            type="button"
            className="user-modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={submitting}
          >
            ×
          </button>
        </header>

        {formError && (
          <div className="user-alert user-alert-error" role="alert">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <div className="user-field">
            <label htmlFor="user-role">Account type *</label>
            <select
              id="user-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={submitting}
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>

          <div className="user-field">
            <label htmlFor="user-name">Full name *</label>
            <input
              id="user-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setErrors((p) => ({ ...p, fullName: "" }));
              }}
              disabled={submitting}
              autoComplete="name"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "user-name-error" : undefined}
            />
            {errors.fullName && (
              <p className="user-field-error" id="user-name-error">
                {errors.fullName}
              </p>
            )}
          </div>

          <div className="user-field">
            <label htmlFor="user-email">Email *</label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((p) => ({ ...p, email: "" }));
              }}
              disabled={submitting}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "user-email-error" : undefined}
            />
            {errors.email && (
              <p className="user-field-error" id="user-email-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="user-field">
            <label htmlFor="user-password">Password *</label>
            <div className="user-password-wrap">
              <input
                id="user-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((p) => ({ ...p, password: "" }));
                }}
                disabled={submitting}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? "user-password-error" : undefined
                }
              />
              <button
                type="button"
                className="user-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                disabled={submitting}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="user-field-error" id="user-password-error">
                {errors.password}
              </p>
            )}
            <p className="user-field-hint">
              Minimum 12 characters. The user can change it after login.
            </p>
          </div>

          <div className="user-form-actions">
            <button
              type="button"
              className="user-button user-button-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="user-button user-button-primary"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create account"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
