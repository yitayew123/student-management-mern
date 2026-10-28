/**
 * Extract a human-readable message from any error shape this app
 * might encounter. Callers should always pass `fallback` when they
 * know their context — e.g. `getErrorMessage(err, "Could not load
 * students.")` reads better in the UI than the generic default.
 *
 * Handled shapes, in priority order:
 *   1. String throw              → returned as-is
 *   2. Normalized error          → err.message (from the api.js interceptor)
 *   3. Raw Axios response        → err.response.data.error.message
 *                                   (the backend envelope from errorHandler.js)
 *   4. Alternative API envelope  → err.response.data.message
 *                                   (defensive — some APIs use a flat shape)
 *   5. Fallback                  → caller-provided or generic
 *
 * Why the response branches come before `error.message`:
 *   Axios sets `error.message = "Request failed with status code 409"`
 *   for HTTP errors — technically a message, but useless to users.
 *   The real message is inside the response payload, so we check
 *   that first. For normalized errors (from the interceptor),
 *   `error.response` is undefined (the interceptor wraps into a
 *   fresh Error), so those branches are skipped and `.message`
 *   carries the already-correct string.
 */
export function getErrorMessage(error, fallback = "Something went wrong.") {
  // Direct string throws — some helper code does `throw "..."`.
  if (typeof error === "string") return error;

  // Backend error envelope: { success:false, error:{ code, message } }
  // This is the shape produced by `errorHandler.js` — covered for
  // both raw Axios errors and manually unwrapped response payloads.
  // ⚠️ `data.error.message` (two levels deep), NOT `data.message`.
  const apiMessage =
    error?.response?.data?.error?.message || error?.response?.data?.message;

  if (typeof apiMessage === "string" && apiMessage) {
    return apiMessage;
  }

  // Normalized error from the interceptor (or a plain `new Error(...)`).
  // By this point `error.response` is undefined (interceptor drops it),
  // so this is the human message we want.
  if (typeof error?.message === "string" && error.message) {
    return error.message;
  }

  return fallback;
}

/**
 * Extract field-level validation errors into a flat lookup map.
 *
 * Returns `{ fieldName: message }` — designed for form components:
 *   const errors = getValidationErrors(err);
 *   <Input error={errors.email} />
 *
 * Handled shapes, in priority order:
 *   1. Normalized error          → err.details (from the api.js interceptor)
 *   2. Raw Axios response        → err.response.data.error.details
 *   3. Alternative API envelope  → err.response.data.details
 *   4. Anything else             → {} (empty map — safe to spread/iterate)
 *
 * The backend builds `details` as `[{ field: "email", message: "..." }]`
 * — see the `validate()` helper in student/course/enrollment controllers.
 *
 * ⚠️ Nested paths: the backend uses `issue.path.join(".")` when the
 * Zod schema has nested fields (e.g., `"address.city"`). The map
 * produced here keeps the key as-is (`errors["address.city"]`), so
 * form components must look up by the dotted string, not
 * `errors.address.city`. For flat schemas (all current endpoints),
 * this is a non-issue.
 *
 * ⚠️ Multiple errors on the same field: the last one wins. In
 * practice Zod emits at most one error per field per request, so
 * this rarely matters — but if two validators fail on the same
 * field, only the second message surfaces.
 */
export function getValidationErrors(error) {
  // Prefer the normalized shape first, then raw-Axios paths. Both
  // `data.error.details` (backend) and `data.details` (alternative
  // APIs) are supported so this helper is safe to call regardless
  // of whether the interceptor ran.
  const details =
    error?.details ??
    error?.response?.data?.error?.details ??
    error?.response?.data?.details;

  if (!Array.isArray(details)) return {};

  return details.reduce((errors, item) => {
    // Guard against malformed items — the array might contain null
    // or non-object entries if the backend changes shape.
    if (item && typeof item === "object" && item.field) {
      errors[item.field] = item.message;
    }
    return errors;
  }, {});
}
