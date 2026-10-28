// ─────────────────────────────────────────────────────────────
// Core middleware imports
// ─────────────────────────────────────────────────────────────
const express = require("express"); // web framework
const cors = require("cors"); // CORS policy
const helmet = require("helmet"); // security headers
const rateLimit = require("express-rate-limit"); // per-IP throttle

// ─────────────────────────────────────────────────────────────
// Config + utilities
// ─────────────────────────────────────────────────────────────
const { env } = require("./config/env"); // validated env vars
const AppError = require("./utils/AppError"); // operational error class

// ─────────────────────────────────────────────────────────────
// Route modules (each imported exactly once)
// ─────────────────────────────────────────────────────────────
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const courseRoutes = require("./routes/courseRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes"); // ← only one
const dashboardRoutes = require("./routes/dashboardRoutes");

// ─────────────────────────────────────────────────────────────
// Tail middleware (mounted last)
// ─────────────────────────────────────────────────────────────
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ─────────────────────────────────────────────────────────────
// Global middleware
// ─────────────────────────────────────────────────────────────

// 1. Security headers on every response.
app.use(helmet());

// 2. CORS — only the configured frontend origin (plus no-origin
//    requests like curl / server-to-server).
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === env.CLIENT_ORIGIN) {
        return callback(null, true);
      }
      return callback(
        new AppError(
          "Origin is not allowed by CORS",
          403,
          "CORS_ORIGIN_DENIED",
        ),
      );
    },
  }),
);

// 3. JSON body parser (10 KB cap).
app.use(express.json({ limit: "10kb" }));

// 4. URL-encoded body parser (10 KB cap).
app.use(
  express.urlencoded({
    extended: false,
    limit: "10kb",
  }),
);

// 5. Rate limiter — 100 requests / 15 min per IP.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res, next) {
    next(
      new AppError(
        "Too many requests. Please try again later.",
        429,
        "RATE_LIMIT_EXCEEDED",
      ),
    );
  },
});

// 6. Apply rate limiter to all /api routes.
app.use("/api", apiLimiter);

// ─────────────────────────────────────────────────────────────
// Route registrations (each mounted exactly once)
// ─────────────────────────────────────────────────────────────
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ─────────────────────────────────────────────────────────────
// Tail middleware (must be last)
// ─────────────────────────────────────────────────────────────

// Catch unmatched routes → forwards a 404 AppError.
app.use(notFound);

// Central error handler — formats all error responses.
app.use(errorHandler);

module.exports = app;
