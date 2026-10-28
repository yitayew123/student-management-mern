import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Spinner from "../../components/ui/Spinner";
import "./LoginPage.css";

/**
 * LoginPage — email/password sign-in form.
 *
 * Flow:
 *   1. AuthContext's session-restore runs on mount (loading=true).
 *   2. When loading finishes:
 *      - If user is already authenticated → redirect (checked below).
 *      - Else → render the form.
 *   3. On submit:
 *      - Client validation → field errors
 *      - Calls auth.login() → server may return 401 (invalid creds)
 *      - On success: redirect to `state.from` (or `/`)
 *      - On failure: shows server error via role="alert"
 *
 * A11Y NOTES:
 *
 *   - Field errors are linked via `aria-describedby` on the input
 *     AND we move focus to the first invalid field on submit failure.
 *     Without the focus move, SR users hear nothing when they submit
 *     an invalid form — they'd have to Tab back through each field to
 *     discover the errors.
 *
 *   - Server errors use `role="alert"` (assertive) — announced
 *     immediately when they appear, no navigation required.
 *
 *   - Form has `aria-busy={pending}` during submit, so SR users
 *     know the form is processing (complements the disabled state).
 *
 *   - Both inputs use `autoComplete` correctly:
 *     - email: "username" (browsers map login email to username)
 *     - password: "current-password" (for login, not signup)
 *
 * SECURITY NOTES:
 *
 *   - `state.from` redirect includes an open-redirect guard
 *     (must start with "/" but not "//"). Prevents:
 *       - //evil.com (protocol-relative)
 *       - https://evil.com (absolute)
 *       - javascript:... (non-slash prefix)
 *     The check matches React Router's own recommended pattern.
 *
 *   - 401 and 403 both show "Invalid email or password" — this
 *     mirrors the backend's enumeration defense. Never reveal
 *     whether the email exists or the account is disabled.
 */
export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);

  // Refs for focus management — moving focus to the first invalid
  // field on submit failure is the standard a11y fix for form errors.
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Loading state during session restore — brief but necessary so we
  // don't flash the form to already-authenticated users.
  // Uses the shared Spinner (which already has role="status" and
  // aria-live="polite") for consistency with ProtectedRoute.
  if (loading) {
    return (
      <main className="auth-page">
        <Spinner label="Checking your session..." />
      </main>
    );
  }

  // Already authenticated → redirect to dashboard. `replace: true`
  // prevents the back button from re-entering the login page.
  if (user) {
    return <Navigate to="/" replace />;
  }

  function validate() {
    const nextErrors = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);

    // ✅ ADDED: move focus to the first invalid field. Without this,
    // SR users who submit an invalid form hear nothing — errors appear
    // visually but aren't announced until they Tab to each field.
    // Focusing the field + the aria-describedby link together
    // announce "Email, invalid, Email is required" in one go.
    if (nextErrors.email) {
      emailRef.current?.focus();
    } else if (nextErrors.password) {
      passwordRef.current?.focus();
    }

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError("");

    // Short-circuit: `pending` check first (avoids validate() while a
    // request is in flight), then `!validate()` (runs validation and
    // focuses the first invalid field if any).
    if (pending || !validate()) return;

    setPending(true);

    try {
      await login(email, password);

      // ── Post-login redirect ──────────────────────────────
      // `state.from` is set by ProtectedRoute when the user was
      // redirected to login. If they came from a protected page,
      // they go back there. Otherwise, default to dashboard.
      //
      // Open-redirect protection: only accept paths starting with
      // "/" but not "//" (blocks //evil.com and absolute URLs).
      const requestedPath = location.state?.from?.pathname;
      const destination =
        requestedPath &&
        requestedPath.startsWith("/") &&
        !requestedPath.startsWith("//")
          ? requestedPath
          : "/";

      navigate(destination, { replace: true });
    } catch (error) {
      // 401/403 → always the same generic message (matches backend's
      // enumeration defense — never reveal whether email exists).
      // Other errors (500, network) surface the actual message from
      // the axios interceptor if available.
      setServerError(
        error.status === 401 || error.status === 403
          ? "Invalid email or password. Please try again."
          : error.message || "Unable to sign in. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        {/* Brand header — "CF" mark is decorative (aria-hidden) */}
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">
            CF
          </span>
          <span>CampusFlow</span>
        </div>

        <div className="auth-heading">
          <p className="auth-eyebrow">STUDENT MANAGEMENT</p>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to continue to your workspace.</p>
        </div>

        {/* Server error banner — role="alert" announces it assertively
            (interrupts SR mid-sentence). Correct for auth errors, which
            are actionable and time-sensitive. */}
        {serverError && (
          <div className="auth-error" role="alert">
            {serverError}
          </div>
        )}

        {/* noValidate: disables the browser's native validation
            bubbles, so our custom validation (and focus management)
            runs consistently across browsers. aria-busy tells SR users
            the form is processing during submit. */}
        <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
          <div className="auth-field">
            <label htmlFor="login-email">Email address</label>
            <input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                // Clear this field's error on edit — standard pattern,
                // prevents stale error messages from lingering.
                setErrors((previous) => ({ ...previous, email: "" }));
                setServerError("");
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              disabled={pending}
              required
            />
            {errors.email && (
              <p className="auth-field-error" id="login-email-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <input
              ref={passwordRef}
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((previous) => ({ ...previous, password: "" }));
                setServerError("");
              }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "login-password-error" : undefined
              }
              disabled={pending}
              required
            />
            {errors.password && (
              <p className="auth-field-error" id="login-password-error">
                {errors.password}
              </p>
            )}
          </div>

          <button className="auth-submit" type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">Secure access to your academic workspace.</p>
      </section>
    </main>
  );
}
