const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Swagger configuration
const { swaggerUi, swaggerDocument } = require("./config/swagger");

// Config + utilities
const { env } = require("./config/env");
const AppError = require("./utils/AppError");

// Route modules
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const courseRoutes = require("./routes/courseRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

// Tail middleware
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ─────────────────────────────────────────────────────────────
// Global middleware
// ─────────────────────────────────────────────────────────────

// 1. Security headers
app.use(helmet());

// 2. CORS configuration
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

// 3. JSON body parser (10 KB cap)
app.use(express.json({ limit: "10kb" }));

// 4. URL-encoded body parser (10 KB cap)
app.use(
  express.urlencoded({
    extended: false,
    limit: "10kb",
  }),
);

// 5. Rate limiter — 100 requests / 15 minutes per IP
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

// 6. Apply rate limiter to API routes
app.use("/api", apiLimiter);

// ─────────────────────────────────────────────────────────────
// API route registrations
// ─────────────────────────────────────────────────────────────

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ─────────────────────────────────────────────────────────────
// Swagger API documentation
// Register before the 404 and error handlers.
// ─────────────────────────────────────────────────────────────

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCssUrl: "",
    customJs: [],
  }),
);

// ─────────────────────────────────────────────────────────────
// Tail middleware — must remain last
// ─────────────────────────────────────────────────────────────

// Catch unmatched routes and forward a 404 AppError.
app.use(notFound);

// Central error handler.
app.use(errorHandler);

module.exports = app;
