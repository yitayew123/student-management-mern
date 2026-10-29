/**
 * Extract a readable message from an API error or thrown Error.
 * Uses `fallback` when the error does not contain a useful message.
 */
export function getErrorMessage(error, fallback = "Something went wrong.") {
  if (typeof error === "string") return error;

  // Check API response messages first; Axios's own message is usually generic.
  const apiMessage =
    error?.response?.data?.error?.message || error?.response?.data?.message;

  if (typeof apiMessage === "string" && apiMessage) {
    return apiMessage;
  }

  if (typeof error?.message === "string" && error.message) {
    return error.message;
  }

  return fallback;
}

/**
 * Convert validation details into a map such as `{ email: "Invalid email" }`.
 * Accepts both normalized errors and API response envelopes.
 */
export function getValidationErrors(error) {
  const details =
    error?.details ??
    error?.response?.data?.error?.details ??
    error?.response?.data?.details;

  if (!Array.isArray(details)) return {};

  // Ignore malformed entries and keep each message under its field name.
  return details.reduce((errors, item) => {
    if (item && typeof item === "object" && item.field) {
      errors[item.field] = item.message;
    }
    return errors;
  }, {});
}
