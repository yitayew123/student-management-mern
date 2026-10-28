const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");
const enrollmentController = require("../controllers/enrollmentController");

const router = express.Router();

router.use(authenticate);

// ── Read endpoints ─────────────────────────────────────────────
// All three roles can READ enrollments, but each with a different
// scope (enforced in enrollmentService.listEnrollments):
//   - Admin       → all enrollments (enrollments.read)
//   - Instructor  → enrollments in own courses (enrollments.read_assigned)
//   - Student     → own enrollments only (enrollments.read_own)
//
// The service layer FORCE-OVERRIDES the filter based on role. A
// student passing `?student=<otherId>` will be silently scoped back
// to their own records — they cannot see other students' enrollments.
router.get(
  "/",
  requirePermission(
    "enrollments.read",
    "enrollments.read_assigned",
    "enrollments.read_own",
  ),
  enrollmentController.list,
);

router.get(
  "/:id",
  requirePermission(
    "enrollments.read",
    "enrollments.read_assigned",
    "enrollments.read_own",
  ),
  enrollmentController.getById,
);

// ── Write endpoints ────────────────────────────────────────────
// Create enrollment: admin (any student → any course) OR instructor
// (only students → their own courses). Course/student scope checked
// in enrollmentService.createEnrollment + courseService.
// Students cannot enroll themselves via this endpoint (self-enrollment
// deferred — would need a separate `/self-enroll` route with its own
// permission).
router.post(
  "/",
  requirePermission("enrollments.create"),
  enrollmentController.create,
);

// Cancel enrollment: admin (any) OR instructor (own courses).
// `enrollments.cancel` is granted to both roles in the default policy.
router.patch(
  "/:id/cancel",
  requirePermission("enrollments.cancel"),
  enrollmentController.cancel,
);

module.exports = router;
