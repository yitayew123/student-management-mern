const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");
const courseController = require("../controllers/courseController");

const router = express.Router();

router.use(authenticate);

// ── Read endpoints ─────────────────────────────────────────────
// Admin: sees all courses (courses.read).
// Instructor: sees only own courses (courses.read_assigned) —
//             ownership filter applied in the service layer.
// Student: currently sees active courses (the service scopes to
//          `status: "active"` — read-only browse).
router.get(
  "/",
  requirePermission("courses.read", "courses.read_assigned"),
  courseController.list,
);

router.get(
  "/:id",
  requirePermission("courses.read", "courses.read_assigned"),
  courseController.getById,
);

// ── Write endpoints ────────────────────────────────────────────
// Create: admin only (instructors cannot create courses).
router.post("/", requirePermission("courses.create"), courseController.create);

// Update: admin (any course) OR instructor (own courses only —
// ownership enforced in courseService.updateCourse).
router.patch(
  "/:id",
  requirePermission("courses.update"),
  courseController.update,
);

// Status change: admin (any) OR instructor (own courses). The
// service layer should additionally reject "archived" transitions
// for non-admins, since archiving is a permanent admin action.
// (See courseService.changeCourseStatus — add that guard if not
// present. Archive = permanent retire; inactive = temporary.)
router.patch(
  "/:id/status",
  requirePermission("courses.update"),
  courseController.changeStatus,
);

module.exports = router;
