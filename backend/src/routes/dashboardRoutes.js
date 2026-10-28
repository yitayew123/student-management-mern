const express = require("express");
const { getSummary } = require("../controllers/dashboardController");

// Direct imports — both middlewares export functions directly
// (`module.exports = authenticate` / `module.exports = authorize`).
// ⚠️ The file is `authMiddleware.js`, not `authorizerMiddleware.js` —
// the "or" typo crashed courseRoutes.js earlier and would crash this
// router at startup. Corrected here.
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");

const router = express.Router();

// ── Router-level middleware (secure-by-default) ───────────────
// Applies to EVERY route defined below. A new route added later
// is authenticated automatically — no wiring needed.

// Populates req.user = { id, email, role } from the DB (via JWT).
router.use(authenticate);

// Reads req.user.role (set above) and 403s anyone not in this list.
// MUST come after `authenticate` — reversing the order makes
// `authorize` read `undefined.role` and every request 401s.
//
// Dashboard metrics reveal org scale (student counts, recent
// activity). Students shouldn't see them — only admins and
// instructors.
router.use(authorize("admin", "instructor"));

// ── Routes ────────────────────────────────────────────────────
// Mounted at /api/admin (see app.js) → full path is:
//   GET /api/admin/summary
// The controller returns aggregate metrics + recent enrollments.
router.get("/summary", getSummary);

module.exports = router;
