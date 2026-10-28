/**
 * Permission catalog — single source of truth for every capability
 * in the app.
 *
 * Keys follow `<module>.<action>` convention. The `_own`, `_assigned`,
 * and unscoped variants (e.g., students.read vs students.read_assigned
 * vs students.read_own) are DELIBERATELY separate:
 *   - `students.read`          — read ALL students (admin)
 *   - `students.read_assigned` — read students in instructor's courses
 *   - `students.read_own`      — read own student record (student)
 *
 * The service layer uses this distinction to apply the correct
 * ownership filter. Do NOT collapse them into a single `students.read`.
 */

const PERMISSIONS = {
  // ── Dashboard ─────────────────────────────────────────────
  "dashboard.read": "View the dashboard",
  "dashboard.read_full": "View system-wide metrics (all students/courses)",

  // ── User Accounts ─────────────────────────────────────────
  "users.read": "View user accounts",
  "users.create": "Create user accounts",
  "users.update": "Update user accounts",
  "users.deactivate": "Activate/deactivate user accounts",

  // ── Students ──────────────────────────────────────────────
  "students.read": "View all student records",
  "students.read_assigned": "View students enrolled in own courses",
  "students.read_own": "View own student profile",
  "students.create": "Create student records",
  "students.update": "Update student records",
  "students.delete": "Change student status (soft-delete)",

  // ── Courses ───────────────────────────────────────────────
  "courses.read": "View all courses",
  "courses.read_assigned": "View own courses",
  "courses.create": "Create courses",
  "courses.update": "Update courses",
  "courses.delete": "Archive courses",

  // ── Enrollments ───────────────────────────────────────────
  "enrollments.read": "View all enrollments",
  "enrollments.read_assigned": "View enrollments in own courses",
  "enrollments.read_own": "View own enrollments",
  "enrollments.create": "Create enrollments",
  "enrollments.cancel": "Cancel enrollments",

  // ── Role Permissions ──────────────────────────────────────
  "role_permissions.read": "View role permissions",
  "role_permissions.update": "Change role permissions",
};

/**
 * Display grouping — used by the admin UI to lay out checkboxes
 * by module. Kept in sync manually with the PERMISSIONS map above.
 */
const PERMISSION_GROUPS = {
  Dashboard: ["dashboard.read", "dashboard.read_full"],
  "User Accounts": [
    "users.read",
    "users.create",
    "users.update",
    "users.deactivate",
  ],
  Students: [
    "students.read",
    "students.read_assigned",
    "students.read_own",
    "students.create",
    "students.update",
    "students.delete",
  ],
  Courses: [
    "courses.read",
    "courses.read_assigned",
    "courses.create",
    "courses.update",
    "courses.delete",
  ],
  Enrollments: [
    "enrollments.read",
    "enrollments.read_assigned",
    "enrollments.read_own",
    "enrollments.create",
    "enrollments.cancel",
  ],
  "Role Permissions": ["role_permissions.read", "role_permissions.update"],
};

/** Initial policy — used by the seed script and as fallback if a
 *  RolePermission document is missing for a role. */
const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    "dashboard.read",
    "dashboard.read_full",
    "users.read",
    "users.create",
    "users.update",
    "users.deactivate",
    "students.read",
    "students.create",
    "students.update",
    "students.delete",
    "courses.read",
    "courses.create",
    "courses.update",
    "courses.delete",
    "enrollments.read",
    "enrollments.create",
    "enrollments.cancel",
    "role_permissions.read",
    "role_permissions.update",
  ],
  instructor: [
    "dashboard.read",
    "students.read_assigned",
    "courses.read_assigned",
    "courses.update", // ownership checked in service layer
    "enrollments.read_assigned",
    "enrollments.create",
    "enrollments.cancel",
  ],
  student: [
    "dashboard.read",
    "students.read_own",
    "courses.read",
    "enrollments.read_own",
  ],
};

module.exports = {
  PERMISSIONS,
  PERMISSION_GROUPS,
  DEFAULT_ROLE_PERMISSIONS,
};
