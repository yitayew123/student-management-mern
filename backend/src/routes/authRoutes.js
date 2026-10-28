const express = require("express");

const authController = require("../controllers/authController");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

// POST /api/auth/login  (public)
// No `authenticate` middleware — a user isn't logged in yet.
// All input validation, credential check, and token generation
// happen in the controller → service layer.
router.post("/login", authController.login);

// GET /api/auth/me  (protected)
// Middleware order matters:
//   1. authenticate → verifies Bearer token, loads user, sets req.user
//   2. controller   → returns the current user's profile
// Swapping the order would run the controller with `req.user === undefined`
// and turn a routing mistake into a 500 instead of a clean 401.
router.get("/me", authenticate, authController.getCurrentUser);

module.exports = router;
