const bcrypt = require("bcrypt");

// bcrypt's cost factor. Each +1 doubles the work, so this is the
// main knob for making brute-force attacks expensive. 12 is the
// current 2024-25 sweet spot: ~250ms per hash on typical hardware —
// slow enough to deter attackers, fast enough for login UX.
// Lower it in tests to keep the suite fast; never lower it in prod.
const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password before storing it.
 *
 * bcrypt.hash() generates a fresh random salt internally and embeds
 * it (plus the cost factor) in the output string — so there is no
 * separate salt column to store. The returned string is self-contained.
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a submitted password with a stored password hash.
 *
 * bcrypt.compare() extracts the salt + cost from `passwordHash` and
 * re-hashes `password` with them, then uses a **constant-time**
 * comparison internally — this prevents timing attacks where the
 * response time leaks how many leading bytes matched.
 *
 * Always resolves to a boolean; throws only on malformed input
 * (e.g., `passwordHash` is not a bcrypt string).
 */
async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  hashPassword,
  comparePassword,
};
