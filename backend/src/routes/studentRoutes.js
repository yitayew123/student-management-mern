const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");
const studentController = require("../controllers/studentController");

const router = express.Router();

// All student endpoints require authentication. Individual endpoints
// gate on permissions (loaded by `authenticate` into req.user.permissions).
router.use(authenticate);

// ── Read endpoints ─────────────────────────────────────────────
// Admin: sees all students (students.read).
// Instructor: sees only students enrolled in their own courses
//             (students.read_assigned) — the service layer applies
//             the ownership filter.
// Student: cannot access these endpoints — blocked by permission.
//          (Students access their own record via /api/auth/me.)
router.get(
  "/",
  requirePermission("students.read", "students.read_assigned"),
  studentController.listStudents,
);

router.get(
  "/:id",
  requirePermission(
    "students.read",
    "students.read_assigned",
    "students.read_own",
  ),
  studentController.getStudentById,
);

// ── Write endpoints — admin only ───────────────────────────────
router.post(
  "/",
  requirePermission("students.create"),
  studentController.createStudent,
);

router.patch(
  "/:id",
  requirePermission("students.update"),
  studentController.updateStudent,
);

router.patch(
  "/:id/status",
  requirePermission("students.delete"),
  studentController.changeStudentStatus,
);

module.exports = router;
