const express = require("express");

// Router for the health-check endpoint (GET /).
// Mounted by the parent router (e.g., at /api/health).
const router = express.Router();

// Health check: confirms the API is up and responding.
// Used by load balancers, uptime monitors, and developers.
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    message: "Student Management System API is running",
    timestamp: new Date().toISOString(), // current server time
  });
});

module.exports = router;
