const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");
const { getSummary } = require("../controllers/dashboardController");
const userController = require("../controllers/userController");
const rolePermissionController = require("../controllers/rolePermissionController");

const router = express.Router();

router.use(authenticate);

// ── Dashboard ──────────────────────────────────────────────────
router.get("/summary", requirePermission("dashboard.read"), getSummary);

// ── User Accounts ──────────────────────────────────────────────
router.get("/users", requirePermission("users.read"), userController.list);
router.post("/users", requirePermission("users.create"), userController.create);
router.patch(
  "/users/:id/status",
  requirePermission("users.deactivate"),
  userController.changeStatus,
);

// ── Role Permissions ───────────────────────────────────────────
router.get(
  "/role-permissions",
  requirePermission("role_permissions.read"),
  rolePermissionController.get,
);
router.patch(
  "/role-permissions/:role",
  requirePermission("role_permissions.update"),
  rolePermissionController.update,
);

module.exports = router;
